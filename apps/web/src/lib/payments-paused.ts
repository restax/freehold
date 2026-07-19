/**
 * Paid-plan kill switch. While true: the pricing page's paid CTAs open the
 * start-free dialog instead of signup, the billing page hides its upgrade
 * buttons, and startUpgrade refuses to create Stripe checkout sessions.
 * Flip to false to restore paid signups.
 */
export const PAYMENTS_PAUSED = false;
