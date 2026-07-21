import { prisma } from "@freehold/db";
import {
  adSubscriptionFromEvent,
  billingEnabled,
  planUpdateFromEvent,
  verifyWebhook,
} from "@freehold/ee-billing";
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

  // Client invoicing is payment-agnostic and never touches Stripe: tenants
  // mark their own invoices paid. This webhook is subscriptions only.

  // Vendor ad subscriptions carry vendorAdId (not tenantId), so the tenant-plan
  // path below ignores them. Payment gates visibility: an approved ad goes dark
  // (PAUSED) when payment lapses and lights back up when it resumes; the ad is
  // never deleted. A newly paid ad stays PENDING until an operator approves it.
  const adUpdate = adSubscriptionFromEvent(event);
  if (adUpdate) {
    const ad = await prisma.vendorAd.findUnique({ where: { id: adUpdate.vendorAdId } });
    if (ad) {
      let status = ad.status;
      if (adUpdate.paid && ad.status === "PAUSED") status = "ACTIVE"; // payment resumed
      if (!adUpdate.paid && ad.status === "ACTIVE") status = "PAUSED"; // payment lapsed
      await prisma.vendorAd
        .update({
          where: { id: ad.id },
          data: {
            status,
            stripeCustomerId: adUpdate.customerId,
            stripeSubscriptionId: adUpdate.subscriptionId,
            periodEnd: adUpdate.periodEnd,
          },
        })
        .catch(() => {});
      if (adUpdate.paid && ad.status === "PENDING") {
        adminAlert(`📢 A vendor ad is paid and awaiting review (ad ${ad.id})`);
      } else if (status === "PAUSED") {
        adminAlert(`⏸️ A vendor ad was paused for non-payment (ad ${ad.id})`);
      }
    }
    return new Response("ok", { status: 200 });
  }

  const update = planUpdateFromEvent(event);
  if (update) {
    adminAlert(
      update.suspended
        ? `⚠️ Payment problem: tenant ${update.tenantId} → ${update.status} (workspace locked)`
        : `💳 Plan change: tenant ${update.tenantId} → ${update.tier} (${update.seats} seats)`,
    );
    await prisma.organization
      .update({
        where: { id: update.tenantId },
        data: {
          planTier: update.tier,
          seatLimit: update.seats,
          stripeCustomerId: update.customerId,
          stripeSubscriptionId: update.subscriptionId,
          subscriptionStatus: update.status,
          // Lock on a failed renewal; clear the lock the moment Stripe reports paid again.
          billingSuspendedAt: update.suspended ? new Date() : null,
        },
      })
      .catch(() => {
        // Unknown tenant (e.g. replayed event for a deleted org) — acknowledge anyway.
      });
  }
  return new Response("ok", { status: 200 });
}
