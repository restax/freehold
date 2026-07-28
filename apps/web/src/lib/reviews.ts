/**
 * The post-close review ask: when to send it, whether a token still opens
 * it, and how to average what came back.
 *
 * Dependency-free (the billing-cadence pattern) — this decides whose inbox
 * gets a real email and rolls up a business's public-facing rating, so the
 * rules are unit-tested rather than trusted.
 */

export const DEFAULT_REVIEW_DELAY_DAYS = 3;

/** How long the emailed link stays good — matches the form-access pattern. */
export const REVIEW_LINK_TTL_HOURS = 24 * 14;

export function reviewLinkExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + REVIEW_LINK_TTL_HOURS * 60 * 60 * 1000);
}

/**
 * A file is due to be asked once it's been closed long enough — and only
 * once, ever: the caller is expected to have already excluded any
 * transaction with a ClientReview row (the row's existence is the "already
 * asked" record, enforced by the DB's unique transaction_id).
 */
export function reviewDue(closeDate: Date, delayDays: number, now: Date = new Date()): boolean {
  const due = new Date(closeDate.getTime() + delayDays * 24 * 60 * 60 * 1000);
  return due.getTime() <= now.getTime();
}

export interface ReviewLinkState {
  expiresAt: Date;
  revokedAt: Date | null;
  answeredAt: Date | null;
}

/**
 * The link opens the form only while unrevoked, unexpired, and unanswered.
 * Unlike a portal or form-access link, a review is one-shot on purpose —
 * reopening an answered link to change a rating isn't a case this needs to
 * support, and treating "already answered" as closed keeps the token from
 * being replayed.
 */
export function reviewLinkUsable(link: ReviewLinkState, now: Date = new Date()): boolean {
  if (link.revokedAt || link.answeredAt) return false;
  return link.expiresAt.getTime() > now.getTime();
}

export function clampRating(raw: unknown): number | null {
  const n =
    typeof raw === "string" ? Number.parseInt(raw, 10) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export interface RatedReview {
  businessRating: number | null;
  coordinatorRating: number | null;
  coordinatorId: string | null;
  coordinatorName: string | null;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** The business's overall average, from every answered review with a business rating. */
export function businessAverage(reviews: readonly RatedReview[]): number | null {
  return average(reviews.map((r) => r.businessRating).filter((r): r is number => r !== null));
}

export interface CoordinatorStanding {
  coordinatorId: string | null;
  coordinatorName: string;
  average: number;
  count: number;
}

/**
 * Per-coordinator averages, sorted best first. Grouped by name rather than
 * id alone — a null id (the coordinator has since left the workspace) still
 * needs to roll up correctly under the name that was captured at send time,
 * and two different people who happen to share a name is a collision this
 * doesn't need to solve.
 */
export function coordinatorStandings(reviews: readonly RatedReview[]): CoordinatorStanding[] {
  const groups = new Map<string, { id: string | null; ratings: number[] }>();
  for (const r of reviews) {
    if (r.coordinatorRating === null || !r.coordinatorName) continue;
    const g = groups.get(r.coordinatorName) ?? { id: r.coordinatorId, ratings: [] };
    g.ratings.push(r.coordinatorRating);
    groups.set(r.coordinatorName, g);
  }
  return [...groups.entries()]
    .map(([coordinatorName, g]) => ({
      coordinatorId: g.id,
      coordinatorName,
      average: average(g.ratings) ?? 0,
      count: g.ratings.length,
    }))
    .sort((a, b) => b.average - a.average);
}
