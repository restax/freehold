import { CreditLedgerReason, prisma } from "@freehold/db";
import {
  adSubscriptionFromEvent,
  billingEnabled,
  creditPurchaseFromEvent,
  planUpdateFromEvent,
  verifyWebhook,
} from "@freehold/ee-billing";
import { adminAlert } from "@/lib/notify";
import { opinly } from "@/lib/opinly";
import { grantCredits } from "@/lib/plans";

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
    // One-time AI credit-pack purchase. Idempotent: a redelivered event finds
    // the ledger row from the first grant (keyed by session id) and skips. The
    // grant itself (balance + ledger) is atomic in grantCredits.
    const purchase = creditPurchaseFromEvent(event);
    if (purchase) {
      const already = await prisma.creditLedger.findFirst({
        where: { reason: CreditLedgerReason.PURCHASE, note: purchase.sessionId },
        select: { id: true },
      });
      if (!already) {
        await grantCredits(
          purchase.tenantId,
          purchase.credits,
          CreditLedgerReason.PURCHASE,
          purchase.sessionId,
        ).catch(() => {});
        adminAlert(
          `🪙 ${purchase.credits} AI credit${purchase.credits === 1 ? "" : "s"} purchased by tenant ${purchase.tenantId}`,
        );
      }
    }

    const cs = event.data.object as {
      id?: string;
      after_expiration?: { recovery?: { url?: string | null } | null } | null;
      amount_total?: number | null;
      currency?: string | null;
      customer_details?: { email?: string | null } | null;
    };

    // Server-side revenue signal for Opinly attribution (which blog posts led to
    // paying customers). Best-effort: never block checkout bookkeeping on it.
    // orderId here matches the externalEventId the confirmation page's client-side
    // track sends (OpinlyPurchaseTracker) — same checkout session id both places —
    // so Opinly dedupes the two into a single purchase event.
    if (purchase && cs.id && typeof cs.amount_total === "number") {
      opinly
        .trackPurchase({
          orderId: purchase.sessionId,
          value: cs.amount_total / 100,
          currency: cs.currency?.toUpperCase(),
          email: cs.customer_details?.email ?? undefined,
          anonId: purchase.opinlyAnonId ?? undefined,
        })
        .catch(() => {});
    }

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
    if (update.tier !== "FREE" && !update.suspended) {
      opinly
        .track(
          "subscribe",
          { tier: update.tier, seats: update.seats },
          { externalEventId: update.subscriptionId ?? undefined },
        )
        .catch(() => {});
    }
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
          // A real subscription supersedes any comp/trial override — a paid tier
          // starting mid-trial shouldn't keep looking "comped" in admin. No-op
          // if compTier is already null.
          ...(update.tier !== "FREE" ? { compTier: null, compExpiresAt: null } : {}),
        },
      })
      .catch(() => {
        // Unknown tenant (e.g. replayed event for a deleted org) — acknowledge anyway.
      });
  }
  return new Response("ok", { status: 200 });
}
