import Stripe from "stripe";

/**
 * Freehold Cloud billing (commercially licensed — see ee/LICENSE).
 *
 * Everything here is config-gated on STRIPE_SECRET_KEY: without it the app
 * runs exactly as before with billing surfaces showing a setup note. Flat
 * plan subscriptions via Checkout Sessions (mode: subscription, quantity 1 —
 * each tier includes a fixed number of seats, none are bought individually);
 * self-service management via the Customer Portal; state sync via webhooks
 * (customer.subscription.* events carry our tenant metadata).
 */

export function billingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;

function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Billing is not configured (STRIPE_SECRET_KEY).");
  client ??= new Stripe(key);
  return client;
}

export type PaidTier = "PRO" | "BUSINESS";

/** Seats included with each tier — flat, not purchasable per seat. */
export const SEATS_BY_TIER: Record<PaidTier | "FREE", number> = {
  FREE: 1,
  PRO: 2,
  BUSINESS: 10,
};

function priceFor(tier: PaidTier): string {
  const price = process.env[tier === "PRO" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_BUSINESS"];
  if (!price) throw new Error(`Missing price id env for ${tier}.`);
  return price;
}

export interface CheckoutInput {
  tenantId: string;
  tier: PaidTier;
  customerEmail: string;
  existingCustomerId: string | null;
  baseUrl: string;
  /** Auto-apply this coupon id (e.g. the launch discount). Stripe forbids
   *  combining a fixed coupon with allow_promotion_codes, so when set we swap
   *  the manual code box for the pre-applied discount. */
  couponId?: string | null;
}

/** Create a subscription Checkout Session; returns URL + id for cart tracking. */
export async function createUpgradeCheckout(
  input: CheckoutInput,
): Promise<{ url: string; sessionId: string }> {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    // No payment_method_types — Stripe selects eligible methods dynamically.
    line_items: [{ price: priceFor(input.tier), quantity: 1 }],
    client_reference_id: input.tenantId,
    ...(input.existingCustomerId
      ? { customer: input.existingCustomerId }
      : { customer_email: input.customerEmail }),
    // No trial_period_days here: every new signup already gets a 14-day
    // full-Pro trial with no card (see startSignupTrial in comp.ts). Someone
    // reaching Checkout has deliberately added a card — whether mid-trial or
    // after it lapsed — so billing starts immediately rather than stacking a
    // second trial on top.
    subscription_data: {
      metadata: { tenantId: input.tenantId, tier: input.tier },
    },
    metadata: { tenantId: input.tenantId, tier: input.tier },
    ...(input.couponId
      ? { discounts: [{ coupon: input.couponId }] }
      : { allow_promotion_codes: true }),
    after_expiration: { recovery: { enabled: true } },
    success_url: `${input.baseUrl}/dashboard/billing?upgraded=1`,
    cancel_url: `${input.baseUrl}/dashboard/billing`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return { url: session.url, sessionId: session.id };
}

// --- One-time AI credit packs (Free tier) ---

/** All three credit-pack prices configured? Gates the "Buy credits" surface. */
export function creditsEnabled(): boolean {
  return Boolean(
    process.env.STRIPE_PRICE_CREDIT_1 &&
      process.env.STRIPE_PRICE_CREDIT_5 &&
      process.env.STRIPE_PRICE_CREDIT_10,
  );
}

/** Env price id for a pack size. Kept here so Stripe env names stay in one place. */
function creditPriceFor(credits: number): string {
  const env =
    credits === 1
      ? "STRIPE_PRICE_CREDIT_1"
      : credits === 5
        ? "STRIPE_PRICE_CREDIT_5"
        : credits === 10
          ? "STRIPE_PRICE_CREDIT_10"
          : null;
  const price = env ? process.env[env] : undefined;
  if (!price) throw new Error(`No credit price configured for ${credits} credits.`);
  return price;
}

export interface CreditCheckoutInput {
  tenantId: string;
  /** Pack size: 1, 5, or 10. */
  credits: number;
  customerEmail: string;
  existingCustomerId: string | null;
  baseUrl: string;
  /** Opinly pixel's anonymous visitor id, carried through to the webhook so its server-side purchase track attributes to the same visitor as the client-side one. */
  opinlyAnonId?: string | null;
}

/**
 * A one-time credit-pack purchase (mode: payment, not a subscription). The
 * session carries tenantId + credits in metadata so the webhook can grant the
 * balance on completion. Separate from plan checkouts — this never creates a
 * subscription and never touches planTier.
 */
export async function createCreditCheckout(
  input: CreditCheckoutInput,
): Promise<{ url: string; sessionId: string }> {
  const metadata = {
    tenantId: input.tenantId,
    credits: String(input.credits),
    ...(input.opinlyAnonId ? { opinlyAnonId: input.opinlyAnonId } : {}),
  };
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: creditPriceFor(input.credits), quantity: 1 }],
    client_reference_id: input.tenantId,
    ...(input.existingCustomerId
      ? { customer: input.existingCustomerId }
      : { customer_email: input.customerEmail }),
    payment_intent_data: { metadata },
    metadata,
    // {CHECKOUT_SESSION_ID} is a Stripe template token, filled in on redirect —
    // it's the same id used as the purchase's externalEventId on both the
    // client-side track (confirmation page) and the server-side one (webhook),
    // so Opinly dedupes them into a single event.
    success_url: `${input.baseUrl}/dashboard/billing?purchased=${input.credits}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.baseUrl}/dashboard/billing`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return { url: session.url, sessionId: session.id };
}

export interface CreditPurchase {
  tenantId: string;
  credits: number;
  /** Checkout session id — used as the idempotency key when granting. */
  sessionId: string;
  /** Opinly pixel anonId, if the checkout carried one. */
  opinlyAnonId: string | null;
}

/**
 * Map a completed one-time Checkout Session to a credit grant. Pure. Returns
 * null for anything that isn't a paid credit-pack purchase (wrong mode, unpaid,
 * or missing credits/tenant metadata — e.g. a plan subscription checkout).
 */
export function creditPurchaseFromEvent(event: Stripe.Event): CreditPurchase | null {
  if (event.type !== "checkout.session.completed") return null;
  const cs = event.data.object as Stripe.Checkout.Session;
  if (cs.mode !== "payment" || cs.payment_status !== "paid") return null;
  const tenantId = cs.metadata?.tenantId;
  const credits = Number(cs.metadata?.credits ?? 0);
  if (!tenantId || !Number.isFinite(credits) || credits <= 0) return null;
  return { tenantId, credits, sessionId: cs.id, opinlyAnonId: cs.metadata?.opinlyAnonId ?? null };
}

/** Whether the vendor-ad monthly price is configured (gates the "Advertise here" panel). */
export function adPriceConfigured(): boolean {
  return Boolean(process.env.STRIPE_PRICE_VENDOR_AD);
}

export interface AdCheckoutInput {
  vendorAdId: string;
  vendorId: string;
  customerEmail: string;
  existingCustomerId: string | null;
  baseUrl: string;
}

/**
 * A vendor buys an ad placement — a monthly subscription, separate from tenant
 * plans. The subscription carries vendorAdId in metadata (not tenantId), so the
 * tenant plan webhook path ignores it and the ad path picks it up.
 */
export async function createAdCheckout(
  input: AdCheckoutInput,
): Promise<{ url: string; sessionId: string }> {
  const price = process.env.STRIPE_PRICE_VENDOR_AD;
  if (!price) throw new Error("Missing STRIPE_PRICE_VENDOR_AD.");
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: input.vendorId,
    ...(input.existingCustomerId
      ? { customer: input.existingCustomerId }
      : { customer_email: input.customerEmail }),
    subscription_data: { metadata: { vendorAdId: input.vendorAdId, vendorId: input.vendorId } },
    metadata: { vendorAdId: input.vendorAdId, vendorId: input.vendorId },
    allow_promotion_codes: true,
    success_url: `${input.baseUrl}/vendor/profile?ad=submitted`,
    cancel_url: `${input.baseUrl}/vendor/profile`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return { url: session.url, sessionId: session.id };
}

export interface AdSubscriptionUpdate {
  vendorAdId: string;
  customerId: string | null;
  subscriptionId: string | null;
  periodEnd: Date | null;
  /** Paid and current — the subscription is active or trialing. */
  paid: boolean;
}

/**
 * Map a Stripe subscription event to an ad payment state. Pure. Returns null
 * for anything that isn't an ad subscription (no vendorAdId in metadata).
 */
export function adSubscriptionFromEvent(event: Stripe.Event): AdSubscriptionUpdate | null {
  if (
    event.type !== "customer.subscription.created" &&
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted"
  ) {
    return null;
  }
  const sub = event.data.object as Stripe.Subscription;
  const vendorAdId = sub.metadata?.vendorAdId;
  if (!vendorAdId) return null;
  const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null);
  const deleted = event.type === "customer.subscription.deleted";
  const paid = !deleted && (sub.status === "active" || sub.status === "trialing");
  const cpe = (sub as { current_period_end?: number }).current_period_end;
  return {
    vendorAdId,
    customerId,
    subscriptionId: deleted ? null : sub.id,
    periodEnd: cpe ? new Date(cpe * 1000) : null,
    paid,
  };
}

/** Customer Portal for self-service manage/cancel; returns the redirect URL. */
export async function createPortalSession(customerId: string, baseUrl: string): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/dashboard/billing`,
  });
  return session.url;
}

export function verifyWebhook(payload: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
  return stripe().webhooks.constructEvent(payload, signature, secret);
}

export interface PlanUpdate {
  tenantId: string;
  tier: PaidTier | "FREE";
  seats: number;
  customerId: string | null;
  subscriptionId: string | null;
  /** Stripe subscription status, or "canceled" for a deleted subscription. */
  status: string;
  /**
   * Lock the workspace for a failed renewal (immediate policy: any past_due /
   * unpaid, or a cancellation Stripe attributes to payment failure). Data is
   * never deleted — the dashboard is gated until payment is fixed.
   */
  suspended: boolean;
}

// Access is normal only while paid-and-current; a failed renewal locks
// immediately by policy, so past_due is NOT treated as healthy.
const HEALTHY_STATUSES = new Set(["active", "trialing"]);
const NONPAYMENT_STATUSES = new Set(["past_due", "unpaid"]);

/**
 * Map a Stripe event to a tenant plan update. Pure — unit-testable without
 * Stripe. Subscription events carry our tenantId/tier in metadata (set at
 * checkout); anything unrecognized returns null and is ignored.
 */
export function planUpdateFromEvent(event: Stripe.Event): PlanUpdate | null {
  if (
    event.type !== "customer.subscription.created" &&
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted"
  ) {
    return null;
  }
  const sub = event.data.object as Stripe.Subscription;
  const tenantId = sub.metadata?.tenantId;
  if (!tenantId) return null;
  const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null);
  const tier: PaidTier = sub.metadata?.tier === "BUSINESS" ? "BUSINESS" : "PRO";
  const deleted = event.type === "customer.subscription.deleted";
  const status = deleted ? "canceled" : sub.status;
  const canceledForNonpayment =
    (deleted || sub.status === "canceled") && sub.cancellation_details?.reason === "payment_failed";

  // Healthy: normal paid access.
  if (HEALTHY_STATUSES.has(status)) {
    return {
      tenantId,
      tier,
      seats: SEATS_BY_TIER[tier],
      customerId,
      subscriptionId: sub.id,
      status,
      suspended: false,
    };
  }

  // Failed renewal (or a nonpayment cancellation): lock, keep the paid tier so
  // restoring on payment is one webhook away; never drop data.
  if (NONPAYMENT_STATUSES.has(status) || canceledForNonpayment) {
    return {
      tenantId,
      tier,
      seats: SEATS_BY_TIER[tier],
      customerId,
      subscriptionId: deleted ? null : sub.id,
      status,
      suspended: true,
    };
  }

  // Voluntary cancellation / incomplete / anything else: back to Free, not locked.
  return {
    tenantId,
    tier: "FREE",
    seats: SEATS_BY_TIER.FREE,
    customerId,
    subscriptionId: null,
    status,
    suspended: false,
  };
}

/**
 * Create a discount coupon + a typeable promotion code. Repeating by default
 * (N months); pass `forever: true` for a discount that never expires once
 * applied to a subscription — the mechanism behind a "locked in" price that
 * survives a later list-price increase (`months` is ignored when set).
 */
export async function createDiscountCoupon(input: {
  code: string;
  amountOffUsd?: number;
  freeMonths?: boolean;
  months: number;
  /** Never expires once applied — overrides `months`/`duration:"repeating"`. */
  forever?: boolean;
  /** Optional redemption deadline for the promotion code (Unix seconds). */
  expiresAt?: number;
  /** Total redemptions allowed across all customers; omit/null = unlimited. */
  maxRedemptions?: number | null;
}): Promise<{ couponId: string; promoCode: string }> {
  const span = input.forever
    ? "forever"
    : `for ${input.months} month${input.months === 1 ? "" : "s"}`;
  const coupon = await stripe().coupons.create({
    ...(input.freeMonths
      ? { percent_off: 100 }
      : { amount_off: Math.round((input.amountOffUsd ?? 0) * 100), currency: "usd" }),
    ...(input.forever
      ? { duration: "forever" }
      : { duration: "repeating", duration_in_months: input.months }),
    name: input.freeMonths ? `Free ${span}` : `$${input.amountOffUsd}/mo off ${span}`,
  });
  const promo = await stripe().promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: input.code,
    ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
    ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}),
  });
  return { couponId: coupon.id, promoCode: promo.code };
}

export async function listPromotionCodes(): Promise<
  Array<{
    code: string;
    name: string | null;
    active: boolean;
    redemptions: number;
    expiresAt: number | null;
    maxRedemptions: number | null;
  }>
> {
  const [promos, coupons] = await Promise.all([
    stripe().promotionCodes.list({ limit: 50 }),
    stripe().coupons.list({ limit: 100 }),
  ]);
  const names = new Map(coupons.data.map((c) => [c.id, c.name ?? null]));
  return promos.data.map((p) => ({
    code: p.code,
    name:
      typeof p.promotion.coupon === "string"
        ? (names.get(p.promotion.coupon) ?? null)
        : (p.promotion.coupon?.name ?? null),
    active: p.active,
    redemptions: p.times_redeemed,
    expiresAt: p.expires_at ?? null,
    maxRedemptions: p.max_redemptions ?? null,
  }));
}

/** Apply a promotion code's coupon to an active subscription (future months). */
export async function applyCouponToSubscription(
  subscriptionId: string,
  code: string,
): Promise<void> {
  const promos = await stripe().promotionCodes.list({ code, limit: 1 });
  const promo = promos.data[0];
  if (!promo) throw new Error(`No promotion code "${code}" found.`);
  await stripe().subscriptions.update(subscriptionId, {
    discounts: [{ promotion_code: promo.id }],
  });
}

/** Topline subscription metrics for the operator analytics panel. */
export async function subscriptionMetrics(sinceDays = 30): Promise<{
  newSubscriptions: number;
  cancellations: number;
  trialing: number;
  activePaid: number;
}> {
  const since = Math.floor(Date.now() / 1000) - sinceDays * 86400;
  const s = stripe();
  const [created, canceled, trialing, active] = await Promise.all([
    s.subscriptions.list({ created: { gte: since }, status: "all", limit: 100 }),
    s.subscriptions.list({ status: "canceled", limit: 100 }),
    s.subscriptions.list({ status: "trialing", limit: 100 }),
    s.subscriptions.list({ status: "active", limit: 100 }),
  ]);
  const recentCanceled = canceled.data.filter((c) => (c.canceled_at ?? 0) >= since);
  return {
    newSubscriptions: created.data.length,
    cancellations: recentCanceled.length,
    trialing: trialing.data.length,
    activePaid: active.data.length,
  };
}
