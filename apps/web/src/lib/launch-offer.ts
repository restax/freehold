import { billingEnabled } from "@freehold/ee-billing";
import { isCloud } from "@/lib/plans";

/**
 * Launch discount: 50% off both paid plans for early Cloud signups, locked in
 * for the life of the promo coupon (create it in Stripe with duration
 * "repeating", ~14 months, so it clears the Sept 2027 guarantee). The offer is
 * driven entirely by the STRIPE_LAUNCH_COUPON env var + the deadline, so it
 * turns on when the coupon exists and turns off after the deadline — no code
 * change to end it.
 */
export const LAUNCH_OFFER = {
  /** Sign up through the end of this day (UTC) to lock in. */
  deadline: new Date("2026-09-01T00:00:00Z"),
  deadlineLabel: "August 31",
  percentOff: 50,
  pro: { regular: 40, launch: 20 },
  business: { regular: 85, launch: 42.5 },
} as const;

/** "$20" for whole dollars, "$42.50" when there are cents. */
export function fmtPrice(usd: number): string {
  return usd % 1 === 0 ? `$${usd}` : `$${usd.toFixed(2)}`;
}

/**
 * The offer is live only on Cloud, only while a launch coupon is configured,
 * and only before the deadline. Gating the marketing on the coupon env means we
 * never advertise a discount the checkout won't actually apply.
 */
export function launchOfferActive(): boolean {
  return (
    isCloud() &&
    billingEnabled() &&
    Boolean(process.env.STRIPE_LAUNCH_COUPON) &&
    Date.now() < LAUNCH_OFFER.deadline.getTime()
  );
}

/** The launch coupon id to attach at checkout while the offer is live. */
export function launchCouponId(): string | null {
  return launchOfferActive() ? (process.env.STRIPE_LAUNCH_COUPON ?? null) : null;
}

/**
 * Time-only check (no Cloud/coupon gating) for surfaces that advertise the
 * Cloud offer from *outside* Cloud — e.g. a self-hosted install pointing users
 * to freeholdtc.dev. Only tells whether the promo window is still open.
 */
export function launchWindowOpen(): boolean {
  return Date.now() < LAUNCH_OFFER.deadline.getTime();
}
