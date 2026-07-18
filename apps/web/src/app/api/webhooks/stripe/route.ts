import { prisma } from "@freehold/db";
import { billingEnabled, planUpdateFromEvent, verifyWebhook } from "@freehold/ee-billing";

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

  // Client invoicing: mark tenant invoices paid/void as Stripe reports them.
  if (event.type === "invoice.paid" || event.type === "invoice.voided") {
    const invoice = event.data.object as { id?: string };
    if (invoice.id) {
      await prisma.invoice
        .updateMany({
          where: { stripeInvoiceId: invoice.id },
          data:
            event.type === "invoice.paid"
              ? { status: "PAID", paidAt: new Date() }
              : { status: "VOID" },
        })
        .catch(() => {});
    }
    return new Response("ok", { status: 200 });
  }

  const update = planUpdateFromEvent(event);
  if (update) {
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
