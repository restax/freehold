/**
 * Saved views and filters for the transactions list.
 *
 * A view is a named bundle of filters a coordinator reaches for constantly —
 * "what's closing soon that's mine", "what did I close this year" — so it's
 * one click, not four dropdowns. The view sets defaults; explicit filters in
 * the URL still win, so a view is a starting point rather than a cage.
 *
 * Dependency-free (the billing-cadence pattern): this decides which files a
 * coordinator sees on the screen they live in all day, and "closing soon"
 * and "closed this year" are date questions that are easy to get subtly
 * wrong. Tested rather than trusted.
 */

import { OPEN_STATUSES } from "./transaction-status";

export const TRANSACTION_VIEWS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "mine-pending", label: "My open (pending items)" },
  { key: "mine-closing", label: "My open (closing soon)" },
  { key: "mine-closed-ytd", label: "My closed (YTD)" },
] as const;

export type TransactionViewKey = (typeof TRANSACTION_VIEWS)[number]["key"];

export function isViewKey(v: unknown): v is TransactionViewKey {
  return TRANSACTION_VIEWS.some((x) => x.key === v);
}

/** Days out that counts as "closing soon" on the saved view. */
export const CLOSING_SOON_DAYS = 14;

/**
 * Re-exported so the page can keep importing its filters and its status set
 * from one module, while lib/transaction-status.ts stays the definition.
 */
export { OPEN_STATUSES };

export interface ViewShape {
  /** Restrict to these statuses; empty means every status. */
  statuses: readonly string[];
  /** Only files this user is assigned to. */
  mineOnly: boolean;
  /** Only files with at least one open task. */
  hasOpenTasks: boolean;
  /** Only files closing within CLOSING_SOON_DAYS of today. */
  closingSoon: boolean;
  /** Only files closed since Jan 1 of the current year. */
  closedThisYear: boolean;
}

const EMPTY: ViewShape = {
  statuses: [],
  mineOnly: false,
  hasOpenTasks: false,
  closingSoon: false,
  closedThisYear: false,
};

/**
 * What a saved view means, as pure data. The page turns this into a Prisma
 * where-clause; keeping the meaning here means the definition of "closing
 * soon" lives in one testable place instead of inline in a query.
 */
export function viewShape(key: TransactionViewKey): ViewShape {
  switch (key) {
    case "open":
      return { ...EMPTY, statuses: OPEN_STATUSES };
    case "mine-pending":
      return { ...EMPTY, statuses: OPEN_STATUSES, mineOnly: true, hasOpenTasks: true };
    case "mine-closing":
      return { ...EMPTY, statuses: OPEN_STATUSES, mineOnly: true, closingSoon: true };
    case "mine-closed-ytd":
      return { ...EMPTY, statuses: ["CLOSED"], mineOnly: true, closedThisYear: true };
    default:
      return EMPTY;
  }
}

/** Inclusive date window for "closing in the next N days", from today. */
export function closingSoonWindow(now: Date, days = CLOSING_SOON_DAYS): { gte: Date; lte: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return { gte: start, lte: end };
}

/** Midnight on Jan 1 of the year `now` falls in. */
export function startOfYear(now: Date): Date {
  return new Date(now.getFullYear(), 0, 1);
}

/**
 * Free-text search across the fields a coordinator actually types into:
 * the address, and the names of people on the file. Returns null for a
 * blank or whitespace-only term so callers can skip the clause entirely
 * rather than filtering on an empty string.
 */
export function searchTerm(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t === "" ? null : t.slice(0, 200);
}

/**
 * Parsed, validated filter state from the URL. Everything is optional; the
 * page applies only what's set. Kept separate from ViewShape because these
 * are the user's explicit choices, which override the view's defaults.
 */
export interface TransactionFilters {
  view: TransactionViewKey;
  q: string | null;
  statuses: string[];
  assigneeIds: string[];
  clientIds: string[];
}

/** One repeated query param (`?status=A&status=B`) as a clean string list. */
export function multiParam(raw: string | string[] | undefined, allowed?: readonly string[]) {
  const list = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  const flat = list
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
  const unique = [...new Set(flat)];
  return allowed ? unique.filter((v) => allowed.includes(v)) : unique;
}

/** True when any filter beyond the view itself is active — drives the "clear" affordance. */
export function hasActiveFilters(f: TransactionFilters): boolean {
  return (
    f.q !== null || f.statuses.length > 0 || f.assigneeIds.length > 0 || f.clientIds.length > 0
  );
}
