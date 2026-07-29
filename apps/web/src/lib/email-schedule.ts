/**
 * When Resend can be trusted to hold a message for us.
 *
 * Split out from lib/email.ts for the same reason lib/nylas-state.ts is split
 * from lib/nylas.ts: that module reaches for Prisma and the branded-template
 * renderer, and this is a pure predicate that should be unit-testable without
 * any of it.
 *
 * The predicate matters more than it looks. Our own outbox is drained by the
 * nightly cron and nothing else — Vercel's Hobby plan allows a project two
 * cron jobs on daily schedules only, and both are already spent, so there is
 * no hourly drain available to add. A schedule Resend will hold arrives on
 * the minute the coordinator picked; one it refuses waits for the nightly
 * run, which can be most of a day late. See lib/outbox.ts.
 */

/**
 * How far out Resend will hold a message: thirty days, the same ceiling Nylas
 * gives us. Unlike Nylas there is no floor — a schedule seconds away is
 * accepted — so anything still in the future qualifies.
 */
export const RESEND_SCHEDULE_MAX_MS = 30 * 24 * 60 * 60 * 1000;

/** Whether Resend can hold this send, or our own outbox has to. */
export function scheduleFitsResend(sendAt: Date, now: Date = new Date()): boolean {
  const delta = sendAt.getTime() - now.getTime();
  return delta > 0 && delta <= RESEND_SCHEDULE_MAX_MS;
}
