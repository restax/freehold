import type { PlanTier } from "@freehold/db";
import { billingEnabled } from "@freehold/ee-billing";
import { isCloud } from "@/lib/plans";

/**
 * Launch discount: a fixed dollar amount off each paid plan, locked in for
 * the life of the subscription — create the two coupons in Stripe with
 * `duration: "forever"` (see `createDiscountCoupon`'s `forever` option), so a
 * later list-price increase never touches someone who redeemed one. $20 off
 * Pro and $25 off Business aren't a uniform percentage of the two prices, so
 * (unlike the original single-coupon 50%-off promo this replaced) this needs
 * one coupon per paid tier, not one shared coupon.
 *
 * The offer is driven entirely by the two env vars + the deadline, so it
 * turns on when both coupons exist and turns off after the deadline — no
 * code change to end it.
 */
export const LAUNCH_OFFER = {
  /** Sign up through the end of this day (UTC) to lock in. */
  deadline: new Date("2028-01-01T00:00:00Z"),
  deadlineLabel: "December 31, 2027",
  pro: { regular: 50, off: 20 },
  business: { regular: 80, off: 25 },
} as const;

const COUPON_ENV: Record<"PRO" | "BUSINESS", string> = {
  PRO: "STRIPE_LAUNCH_COUPON_PRO",
  BUSINESS: "STRIPE_LAUNCH_COUPON_BUSINESS",
};

/** "$20" for whole dollars, "$42.50" when there are cents. */
export function fmtPrice(usd: number): string {
  return usd % 1 === 0 ? `$${usd}` : `$${usd.toFixed(2)}`;
}

/** The discounted monthly price for a paid tier. */
export function launchPrice(tier: "PRO" | "BUSINESS"): number {
  const info = tier === "PRO" ? LAUNCH_OFFER.pro : LAUNCH_OFFER.business;
  return info.regular - info.off;
}

/**
 * The offer is live only on Cloud, only while that tier's launch coupon is
 * configured, and only before the deadline. Gating the marketing on the
 * coupon env means we never advertise a discount the checkout won't actually
 * apply.
 */
export function launchOfferActive(tier: "PRO" | "BUSINESS" = "PRO"): boolean {
  return (
    isCloud() &&
    billingEnabled() &&
    Boolean(process.env[COUPON_ENV[tier]]) &&
    Date.now() < LAUNCH_OFFER.deadline.getTime()
  );
}

/** Whether either tier's launch coupon is live — for banners that don't name a tier. */
export function anyLaunchOfferActive(): boolean {
  return launchOfferActive("PRO") || launchOfferActive("BUSINESS");
}

/** The launch coupon id to attach at checkout while that tier's offer is live. */
export function launchCouponId(tier: PlanTier): string | null {
  if (tier !== "PRO" && tier !== "BUSINESS") return null;
  return launchOfferActive(tier) ? (process.env[COUPON_ENV[tier]] ?? null) : null;
}

/**
 * Time-only check (no Cloud/coupon gating) for surfaces that advertise the
 * Cloud offer from *outside* Cloud — e.g. a self-hosted install pointing users
 * to freeholdtc.dev. Only tells whether the promo window is still open.
 */
export function launchWindowOpen(): boolean {
  return Date.now() < LAUNCH_OFFER.deadline.getTime();
}
