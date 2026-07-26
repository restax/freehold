/**
 * Staleness alerts: which files have gone quiet, and which are quiet with a
 * critical date bearing down.
 *
 * The rule, in the coordinator's words: a file nobody has touched in three
 * business days needs a flag — but inside the week before a critical date,
 * one day of silence is already too long. Critical dates in priority order:
 * closing, mortgage commitment, inspection deadline.
 *
 * Everything here is pure and date-injectable so the whole predicate is
 * unit-testable; nothing reads the clock on its own. `today` is always a
 * calendar day (see `startOfDay`), never an instant, because "three business
 * days" is a question about dates on a wall calendar, not 72 hours.
 */

/** Workspace defaults, overridable per client (Client.alertConfig). */
export const DEFAULT_ALERT_CONFIG = {
  /** Business days of silence before an ordinary file is flagged. */
  staleDays: 3,
  /** Calendar days before a critical date that counts as "bearing down". */
  criticalWindowDays: 7,
  /** Business days of silence tolerated inside that window. */
  criticalStaleDays: 1,
} as const;

export interface AlertConfig {
  staleDays: number;
  criticalWindowDays: number;
  criticalStaleDays: number;
}

/** Clamp to sane bounds so a bad stored value can't disable or spam alerts. */
function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? Math.round(v) : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/**
 * Merge a client's stored overrides over the workspace defaults. Unset or
 * malformed keys fall back rather than throwing — this runs while rendering
 * the dashboard, and a typo in one client's JSON must never blank the page.
 */
export function resolveAlertConfig(raw: unknown): AlertConfig {
  const c = (raw ?? {}) as Partial<Record<keyof AlertConfig, unknown>>;
  return {
    staleDays: clamp(c.staleDays, 1, 60, DEFAULT_ALERT_CONFIG.staleDays),
    criticalWindowDays: clamp(c.criticalWindowDays, 1, 90, DEFAULT_ALERT_CONFIG.criticalWindowDays),
    criticalStaleDays: clamp(c.criticalStaleDays, 1, 60, DEFAULT_ALERT_CONFIG.criticalStaleDays),
  };
}

/** Midnight of the given date, so day math never inherits a time component. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/**
 * Business days from `from` to `to`, counting the days *after* `from` up to
 * and including `to`, skipping weekends. Same-day (or a future `from`) is 0.
 *
 * Touching a file on Friday and looking on Monday is one business day of
 * silence, not three — which is the whole point of counting this way.
 */
export function businessDaysBetween(from: Date, to: Date): number {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (end <= start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    if (!isWeekend(cursor)) count += 1;
  }
  return count;
}

/** Whole calendar days from `from` to `to`; negative when `to` is past. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

export type CriticalDateKind = "close" | "mortgageCommitment" | "inspectionDeadline";

export const CRITICAL_DATE_LABEL: Record<CriticalDateKind, string> = {
  close: "Closing",
  mortgageCommitment: "Mortgage commitment",
  inspectionDeadline: "Inspection deadline",
};

export interface CriticalDatesInput {
  closeDate?: Date | null;
  mortgageCommitmentDate?: Date | null;
  inspectionDeadlineDate?: Date | null;
}

export interface UpcomingCriticalDate {
  kind: CriticalDateKind;
  label: string;
  date: Date;
  /** Calendar days until it lands; 0 is today. Never negative (past ones drop). */
  daysAway: number;
}

/**
 * Upcoming critical dates inside the window, soonest first. Ties break by the
 * declared priority — closing outranks mortgage commitment outranks the
 * inspection deadline — so two dates on the same day report the one that
 * actually matters most.
 *
 * Dates already past are dropped: a blown deadline is a different problem
 * than an approaching one, and escalating forever on it would train people
 * to ignore the flag.
 */
export function upcomingCriticalDates(
  txn: CriticalDatesInput,
  today: Date,
  windowDays: number,
): UpcomingCriticalDate[] {
  const ordered: Array<[CriticalDateKind, Date | null | undefined]> = [
    ["close", txn.closeDate],
    ["mortgageCommitment", txn.mortgageCommitmentDate],
    ["inspectionDeadline", txn.inspectionDeadlineDate],
  ];
  return ordered
    .flatMap(([kind, date], priority) => {
      if (!date) return [];
      const daysAway = calendarDaysBetween(today, date);
      if (daysAway < 0 || daysAway > windowDays) return [];
      return [{ kind, label: CRITICAL_DATE_LABEL[kind], date, daysAway, priority }];
    })
    .sort((a, b) => a.daysAway - b.daysAway || a.priority - b.priority)
    .map(({ kind, label, date, daysAway }) => ({ kind, label, date, daysAway }));
}

export interface StalenessInput {
  /** When the file was last touched by a person; null = never. */
  lastTouchedAt: Date | null;
  /** Falls back to the transaction's creation date when never touched. */
  createdAt: Date;
  dates: CriticalDatesInput;
  config: AlertConfig;
  today: Date;
}

export interface Staleness {
  /** Business days of silence. */
  quietDays: number;
  /** Business days tolerated before flagging, given the critical-date window. */
  threshold: number;
  stale: boolean;
  /** Set when the tightened threshold is in force. */
  escalatedBy: UpcomingCriticalDate | null;
  /** Every upcoming critical date in the window, soonest first. */
  upcoming: UpcomingCriticalDate[];
}

/**
 * The whole rule in one place, so the dashboard, the transaction page, the
 * briefing email, and the PDF can never disagree about whether a file is
 * flagged.
 */
export function staleness(input: StalenessInput): Staleness {
  const { lastTouchedAt, createdAt, dates, config, today } = input;
  const since = lastTouchedAt ?? createdAt;
  const quietDays = businessDaysBetween(since, today);
  const upcoming = upcomingCriticalDates(dates, today, config.criticalWindowDays);
  const escalatedBy = upcoming[0] ?? null;
  const threshold = escalatedBy ? config.criticalStaleDays : config.staleDays;
  return { quietDays, threshold, stale: quietDays >= threshold, escalatedBy, upcoming };
}

/** One-line reason for the flag, shared by every surface that renders it. */
export function stalenessMessage(s: Staleness): string {
  const days = `${s.quietDays} business day${s.quietDays === 1 ? "" : "s"}`;
  if (!s.escalatedBy) return `No activity in ${days}.`;
  const c = s.escalatedBy;
  const when = c.daysAway === 0 ? "today" : c.daysAway === 1 ? "tomorrow" : `in ${c.daysAway} days`;
  return `No activity in ${days} — ${c.label.toLowerCase()} ${when}.`;
}
