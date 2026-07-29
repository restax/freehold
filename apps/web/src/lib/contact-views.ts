/**
 * Saved views and filters for the contacts list.
 *
 * Same shape as lib/transaction-views.ts and for the same reason: a view is a
 * question a coordinator asks constantly ("who haven't I spoken to in three
 * months?"), and it should be one click rather than four dropdowns. The view
 * sets defaults; explicit filters in the URL still win, so a view is a
 * starting point rather than a cage.
 *
 * Dependency-free (the billing-cadence pattern). Category matching in
 * particular earns its tests — it supports exclusions, and an off-by-one there
 * quietly hides people from a mailing list.
 */

export const CONTACT_VIEWS = [
  { key: "all", label: "All" },
  { key: "participants", label: "On open files" },
  { key: "tasks", label: "Pending tasks" },
  // "SOI" is industry shorthand; the wording table says spell it out.
  { key: "sphere", label: "My sphere" },
  { key: "sphere-stale", label: "My sphere (90+ days)" },
  { key: "touch", label: "Upcoming touch dates" },
] as const;

export type ContactViewKey = (typeof CONTACT_VIEWS)[number]["key"];

export function isContactViewKey(v: unknown): v is ContactViewKey {
  return CONTACT_VIEWS.some((x) => x.key === v);
}

/** The category that marks somebody as part of the workspace's sphere. */
export const SPHERE_CATEGORY = "Sphere";

/** How long without contact before a sphere relationship counts as cold. */
export const STALE_DAYS = 90;

/** Days ahead that count as an "upcoming" touch date. */
export const UPCOMING_DAYS = 14;

export interface ContactViewShape {
  /** Only contacts this user owns. */
  mineOnly: boolean;
  /** Only contacts carrying the sphere category. */
  sphereOnly: boolean;
  /** Only contacts last touched more than STALE_DAYS ago (or never). */
  staleOnly: boolean;
  /** Only contacts whose next touch falls within UPCOMING_DAYS. */
  upcomingTouch: boolean;
  /** Only contacts named on a transaction that's still open. */
  onOpenFile: boolean;
  /** Only contacts with at least one unfinished task. */
  openTasks: boolean;
}

const EMPTY: ContactViewShape = {
  mineOnly: false,
  sphereOnly: false,
  staleOnly: false,
  upcomingTouch: false,
  onOpenFile: false,
  openTasks: false,
};

export function contactViewShape(key: ContactViewKey): ContactViewShape {
  switch (key) {
    case "participants":
      return { ...EMPTY, onOpenFile: true };
    case "tasks":
      return { ...EMPTY, openTasks: true };
    case "sphere":
      return { ...EMPTY, mineOnly: true, sphereOnly: true };
    case "sphere-stale":
      return { ...EMPTY, mineOnly: true, sphereOnly: true, staleOnly: true };
    case "touch":
      return { ...EMPTY, upcomingTouch: true };
    default:
      return EMPTY;
  }
}

/** The cutoff a "cold" relationship is measured against. */
export function staleBefore(now: Date, days = STALE_DAYS): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/** The window an "upcoming" touch date has to fall inside. */
export function upcomingWindow(now: Date, days = UPCOMING_DAYS): { gte: Date; lte: Date } {
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + days);
  return { gte: now, lte: end };
}

export interface CategoryFilter {
  /** Must carry at least one of these. */
  include: string[];
  /** Must carry none of these. */
  exclude: string[];
}

/**
 * "sphere, past client, -vendor" → include sphere/past client, exclude vendor.
 *
 * The leading minus is the escape hatch that makes a mailing list workable:
 * "everyone in my sphere who isn't a vendor" is otherwise two passes and a
 * spreadsheet. Blank entries and a bare "-" are dropped rather than turned
 * into a filter that matches nothing.
 */
export function parseCategoryFilter(raw: string | string[] | undefined): CategoryFilter {
  const parts = (Array.isArray(raw) ? raw : (raw ?? "").split(","))
    .flatMap((p) => String(p).split(","))
    .map((p) => p.trim())
    .filter((p) => p !== "" && p !== "-");

  const include: string[] = [];
  const exclude: string[] = [];
  for (const p of parts) {
    if (p.startsWith("-")) exclude.push(p.slice(1).trim());
    else include.push(p);
  }
  return { include, exclude };
}

export interface ContactFilters {
  view: ContactViewKey;
  q: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  categories: CategoryFilter;
  /** Only contacts with no categories at all. */
  noCategory: boolean;
  ownerIds: string[];
}

function trimmed(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

/** Repeated query params → a clean id list, deduped. */
export function multiValue(raw: string | string[] | undefined): string[] {
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  return [...new Set(list.map((v) => String(v).trim()).filter(Boolean))];
}

/** Whether anything narrows the list beyond the view itself. */
export function hasContactFilters(f: ContactFilters): boolean {
  return (
    f.q !== null ||
    f.firstName !== null ||
    f.lastName !== null ||
    f.company !== null ||
    f.categories.include.length > 0 ||
    f.categories.exclude.length > 0 ||
    f.noCategory ||
    f.ownerIds.length > 0
  );
}

export function readContactFilters(params: Record<string, string | string[] | undefined>) {
  return {
    view: isContactViewKey(params.view) ? params.view : ("all" as ContactViewKey),
    q: trimmed(params.q),
    firstName: trimmed(params.firstName),
    lastName: trimmed(params.lastName),
    company: trimmed(params.company),
    categories: parseCategoryFilter(params.category),
    noCategory: params.noCategory === "1",
    ownerIds: multiValue(params.owner),
  } satisfies ContactFilters;
}
