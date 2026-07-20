import { prisma, withTenant } from "@freehold/db";
import {
  type DirectoryListing,
  freeholdListing,
  type PublicFeedEntry,
  publicListing,
} from "./directory";

/**
 * Loading directory listings from both sources. The pure normalizing and
 * filtering logic lives in ./directory; this module does the I/O.
 *
 * The public feed (FindTCPros) is configured with FINDTCPROS_FEED_URL —
 * absent, the directory shows Freehold workspaces only, which is also the
 * self-hosted default. It is a third party, so every failure mode (down, slow,
 * malformed, hostile) degrades to "no public listings" instead of breaking the
 * page. See docs/directory-api.md for the contract.
 */

/**
 * Every workspace that opted into the directory, with its coverage states.
 *
 * Coverage lives in `tenant_state`, which has row-level security forced, so a
 * plain cross-tenant read returns nothing — correctly. The listing is
 * published data, but it's still assembled per tenant inside `withTenant`
 * rather than reaching around the policy.
 */
export async function loadFreeholdListings(): Promise<DirectoryListing[]> {
  const tenants = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true, directoryConfig: true },
  });
  const listed = tenants.filter(
    (t) => (t.directoryConfig as { listed?: boolean } | null)?.listed === true,
  );
  const withStates = await Promise.all(
    listed.map(async (t) => ({
      ...t,
      states: await withTenant(t.id, (tx) =>
        tx.tenantState.findMany({ select: { state: true }, orderBy: { state: "asc" } }),
      ),
    })),
  );
  return withStates.map((t) => freeholdListing(t)).filter((l): l is DirectoryListing => l !== null);
}

/** The same set, in the wire shape the outbound syndication feed publishes. */
export async function loadFreeholdFeedRows() {
  const listings = await loadFreeholdListings();
  const slugs = await prisma.organization.findMany({ select: { id: true, slug: true } });
  const slugById = new Map(slugs.map((s) => [s.id, s.slug]));
  return listings.map((l) => ({
    slug: slugById.get(l.id) ?? l.id,
    name: l.name,
    states: l.states,
    specializations: l.specializations,
    software: l.software,
    availability: l.availability,
    pricingModel: l.pricingModel,
    yearsExperience: l.yearsExperience,
    remote: l.remote,
    blurb: l.blurb,
    contactEmail: l.contactEmail,
    freeholdEnabled: true,
  }));
}

const TIMEOUT_MS = 4000;
/** Cache for an hour — a directory changes daily at most. */
const REVALIDATE_SECONDS = 3600;
/** A feed far larger than this is a bug or an attack; take the head of it. */
const MAX_ENTRIES = 2000;

export function publicFeedUrl(): string | null {
  const raw = process.env.FINDTCPROS_FEED_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).toString();
  } catch {
    return null;
  }
}

export interface FeedResult {
  listings: DirectoryListing[];
  /** Set when the feed is configured but unusable, for a quiet UI note. */
  error: string | null;
  configured: boolean;
}

export async function fetchPublicListings(): Promise<FeedResult> {
  const url = publicFeedUrl();
  if (!url) return { listings: [], error: null, configured: false };

  const token = process.env.FINDTCPROS_FEED_TOKEN?.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      return { listings: [], error: `Public directory returned ${res.status}.`, configured: true };
    }
    const body: unknown = await res.json();
    const rows: unknown = Array.isArray(body)
      ? body
      : ((body as { listings?: unknown })?.listings ?? null);
    if (!Array.isArray(rows)) {
      return {
        listings: [],
        error: "Public directory sent an unexpected shape.",
        configured: true,
      };
    }
    const listings = rows
      .slice(0, MAX_ENTRIES)
      .map((r) => publicListing(r as PublicFeedEntry, url))
      .filter((l): l is DirectoryListing => l !== null);
    return { listings, error: null, configured: true };
  } catch {
    // Timeout, DNS, TLS, bad JSON — all the same to the person browsing.
    return { listings: [], error: "Public directory is unreachable right now.", configured: true };
  } finally {
    clearTimeout(timer);
  }
}
