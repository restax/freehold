import { prisma, withTenant } from "@freehold/db";
import { billingEnabled, planUpdateFromEvent, verifyWebhook } from "@freehold/ee-billing";
import { adminAlert } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** Stripe webhook: keeps tenant plan/seat state in sync with subscriptions. */
export async function POST(req: Request) {
  if (!billingEnabled() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Billing not configured", { status: 503 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: ReturnType<typeof verifyWebhook>;
  try {
    event = verifyWebhook(await req.text(), signature);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Cart tracking: close the loop on checkout sessions we started.
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
    const cs = event.data.object as {
      id?: string;
      after_expiration?: { recovery?: { url?: string | null } | null } | null;
    };
    if (cs.id) {
      await prisma.checkoutAttempt
        .update({
          where: { id: cs.id },
          data:
            event.type === "checkout.session.completed"
              ? { completedAt: new Date() }
              : { expiredAt: new Date(), recoveryUrl: cs.after_expiration?.recovery?.url ?? null },
        })
        .catch(() => {}); // sessions started before tracking existed
    }
    return new Response("ok", { status: 200 });
  }

  // Client invoicing: mark tenant invoices paid/void as Stripe reports them.
  // The invoice table is RLS-protected, so the update must run inside the
  // tenant scope; we stamped the tenant id into the Stripe invoice metadata.
  if (event.type === "invoice.paid" || event.type === "invoice.voided") {
    const invoice = event.data.object as {
      id?: string;
      metadata?: { freeholdTenantId?: string };
    };
    const tenantId = invoice.metadata?.freeholdTenantId;
    if (invoice.id && tenantId) {
      await withTenant(tenantId, (tx) =>
        tx.invoice.updateMany({
          where: { stripeInvoiceId: invoice.id },
          data:
            event.type === "invoice.paid"
              ? { status: "PAID", paidAt: new Date() }
              : { status: "VOID" },
        }),
      ).catch(() => {});
    }
    return new Response("ok", { status: 200 });
  }

  const update = planUpdateFromEvent(event);
  if (update) {
    adminAlert(
      `💳 Plan change: tenant ${update.tenantId} → ${update.tier} (${update.seats} seats)`,
    );
    await prisma.organization
      .update({
        where: { id: update.tenantId },
        data: {
          planTier: update.tier,
          seatLimit: update.seats,
          stripeCustomerId: update.customerId,
          stripeSubscriptionId: update.subscriptionId,
        },
      })
      .catch(() => {
        // Unknown tenant (e.g. replayed event for a deleted org) — acknowledge anyway.
      });
  }
  return new Response("ok", { status: 200 });
}
