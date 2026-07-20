/**
 * The coordinator directory, merged from two sources:
 *
 *  - **Freehold Enabled** — workspaces on this instance that opted in. They
 *    run Freehold, so a file can be handed to them directly (engagements).
 *  - **Public Directory** — listings syndicated from the FindTCPros public
 *    directory. Informational: they aren't workspaces here, so there's nobody
 *    to grant access to; the card links out to their public profile.
 *
 * Both normalize to `DirectoryListing` so one list can filter and sort across
 * them. The vocabularies (specializations, software, availability, pricing)
 * deliberately match FindTCPros's filters so a merged filter means the same
 * thing on both sides.
 */

export type ListingSource = "freehold" | "public";

export interface DirectoryListing {
  source: ListingSource;
  /** Stable within a source; tenant id, or the public directory's slug. */
  id: string;
  name: string;
  /** Two-letter state codes served. */
  states: string[];
  city: string | null;
  specializations: string[];
  software: string[];
  availability: string | null;
  pricingModel: string | null;
  licenseStatus: string | null;
  yearsExperience: number | null;
  remote: boolean;
  verified: boolean;
  rating: number | null;
  reviewCount: number | null;
  blurb: string | null;
  /** Freehold listings only — the workspace's stated contact address. */
  contactEmail: string | null;
  /** Public listings only — their profile on the public directory. */
  profileUrl: string | null;
  /**
   * Whether a file can actually be handed to them from inside Freehold.
   * True only for Freehold workspaces; a public listing has no account here.
   */
  engageable: boolean;
}

/** Shape stored in Organization.directoryConfig. */
export interface DirectoryConfig {
  listed?: boolean;
  blurb?: string;
  contactEmail?: string;
  specializations?: string[];
  software?: string[];
  availability?: string;
  pricingModel?: string;
  yearsExperience?: number;
  remote?: boolean;
}

export const SPECIALIZATIONS = ["Residential", "Commercial", "Luxury", "Land"] as const;

export const SOFTWARE = [
  "Dotloop",
  "DocuSign",
  "DocuSign Rooms",
  "SkySlope",
  "Command",
  "ZipForms",
  "Paperless Pipeline",
  "Brokermint",
  "TransactionDesk",
] as const;

export const AVAILABILITY = ["Per transaction", "Part-time", "Full-time"] as const;
export const PRICING_MODELS = ["Per transaction", "Monthly retainer", "Both"] as const;

export const SOURCE_LABEL: Record<ListingSource, string> = {
  freehold: "Freehold Enabled",
  public: "Public Directory",
};

export function readDirectoryConfig(raw: unknown): DirectoryConfig {
  return (raw ?? {}) as DirectoryConfig;
}

/** A listed workspace as a directory entry. */
export function freeholdListing(tenant: {
  id: string;
  name: string;
  directoryConfig: unknown;
  states: Array<{ state: string }>;
}): DirectoryListing | null {
  const cfg = readDirectoryConfig(tenant.directoryConfig);
  if (!cfg.listed) return null;
  return {
    source: "freehold",
    id: tenant.id,
    name: tenant.name,
    states: tenant.states.map((s) => s.state.toUpperCase()).sort(),
    city: null,
    specializations: cfg.specializations ?? [],
    software: cfg.software ?? [],
    availability: cfg.availability ?? null,
    pricingModel: cfg.pricingModel ?? null,
    licenseStatus: null,
    yearsExperience: cfg.yearsExperience ?? null,
    remote: cfg.remote ?? true,
    // "Verified" on a Freehold listing means exactly one thing: they run a
    // real workspace on this instance. It is never claimed for public rows.
    verified: true,
    rating: null,
    reviewCount: null,
    blurb: cfg.blurb ?? null,
    contactEmail: cfg.contactEmail ?? null,
    profileUrl: null,
    engageable: true,
  };
}

/** One row of the public feed; see docs/directory-api.md for the contract. */
export interface PublicFeedEntry {
  slug?: unknown;
  name?: unknown;
  state?: unknown;
  states?: unknown;
  city?: unknown;
  specializations?: unknown;
  software?: unknown;
  availability?: unknown;
  pricingModel?: unknown;
  licenseStatus?: unknown;
  yearsExperience?: unknown;
  remote?: unknown;
  verified?: unknown;
  rating?: unknown;
  reviewCount?: unknown;
  blurb?: unknown;
  profileUrl?: unknown;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/**
 * Normalize one public-feed row. Returns null for anything unusable rather
 * than throwing — a malformed row in someone else's feed must never take the
 * directory down. Feed content is data, never trusted markup: it renders as
 * text and links are constrained to the configured origin.
 */
export function publicListing(entry: PublicFeedEntry, feedOrigin: string): DirectoryListing | null {
  const name = str(entry.name);
  const slug = str(entry.slug);
  if (!name || !slug) return null;

  const states = (
    strArray(entry.states).length > 0 ? strArray(entry.states) : [str(entry.state) ?? ""]
  )
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{2}$/.test(s));

  // Only accept a profile URL on the feed's own origin; anything else is
  // dropped so a compromised feed can't point users at an unrelated site.
  let profileUrl: string | null = null;
  const rawUrl = str(entry.profileUrl);
  if (rawUrl) {
    try {
      const url = new URL(rawUrl, feedOrigin);
      if (url.origin === new URL(feedOrigin).origin) profileUrl = url.toString();
    } catch {
      profileUrl = null;
    }
  }

  return {
    source: "public",
    id: slug,
    name,
    states,
    city: str(entry.city),
    specializations: strArray(entry.specializations),
    software: strArray(entry.software),
    availability: str(entry.availability),
    pricingModel: str(entry.pricingModel),
    licenseStatus: str(entry.licenseStatus),
    yearsExperience: num(entry.yearsExperience),
    remote: entry.remote === true,
    verified: entry.verified === true,
    rating: num(entry.rating),
    reviewCount: num(entry.reviewCount),
    blurb: str(entry.blurb),
    contactEmail: null,
    profileUrl,
    engageable: false,
  };
}

export interface DirectoryFilter {
  state?: string;
  specialization?: string;
  software?: string;
  source?: ListingSource;
  /** Free-text over name and blurb. */
  q?: string;
}

export function filterListings(
  listings: DirectoryListing[],
  filter: DirectoryFilter,
): DirectoryListing[] {
  const state = filter.state?.trim().toUpperCase();
  const q = filter.q?.trim().toLowerCase();
  return listings.filter((l) => {
    if (filter.source && l.source !== filter.source) return false;
    if (state && !l.states.includes(state)) return false;
    if (filter.specialization && !l.specializations.includes(filter.specialization)) return false;
    if (filter.software && !l.software.includes(filter.software)) return false;
    if (q && !`${l.name} ${l.blurb ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export type DirectorySort = "source" | "name" | "experience";

/**
 * Default order puts Freehold-enabled workspaces first — they're the ones a
 * file can actually be handed to without leaving the app — then alphabetical
 * within each group.
 */
export function sortListings(
  listings: DirectoryListing[],
  sort: DirectorySort,
): DirectoryListing[] {
  const byName = (a: DirectoryListing, b: DirectoryListing) => a.name.localeCompare(b.name);
  const copy = [...listings];
  if (sort === "name") return copy.sort(byName);
  if (sort === "experience") {
    return copy.sort(
      (a, b) => (b.yearsExperience ?? -1) - (a.yearsExperience ?? -1) || byName(a, b),
    );
  }
  return copy.sort(
    (a, b) => (a.source === b.source ? 0 : a.source === "freehold" ? -1 : 1) || byName(a, b),
  );
}
