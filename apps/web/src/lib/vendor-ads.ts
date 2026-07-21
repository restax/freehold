import { prisma } from "@freehold/db";
import { isStateCode } from "./vendor-profile";

/**
 * The placement read: only ACTIVE (operator-approved, paid) ads, and only for
 * the Sponsored slots. Deliberately never called from /compare or /recommend —
 * those pages carry the "nobody is paid to recommend Freehold" promise and stay
 * unpaid. Ads are a vendor buying visibility, clearly labelled, which is a
 * different thing; keeping them off those two pages is what keeps it honest.
 *
 * Inventory is regional: each ad targets up to 4 states, and each state has 4
 * Sponsored slots (the "50 states × 4 spaces" the marketplace sells). A viewer
 * sees the ads targeting their own state; when we can't tell their state, they
 * get a nationwide fill so the row is never empty.
 */

/** Slots per state — the sellable inventory ceiling. */
export const AD_SLOTS_PER_STATE = 4;
/** Most states a single ad may target. */
export const MAX_AD_STATES = 4;

export interface SponsoredAd {
  id: string;
  headline: string;
  body: string;
  /** Where the ad card links: the vendor's public page when they have a slug,
   *  falling back to their entered URL for any older ad without one. */
  href: string;
  vendorName: string;
  category: string;
}

/**
 * Resolve a raw list of submitted state values into the set an ad may target:
 * uppercased, real state codes only, de-duplicated, with states whose slots are
 * already full dropped, and capped at MAX_AD_STATES. `fill` is the active-ad
 * count per state, already excluding this ad. Pure — the action does the I/O.
 */
export function pickAdStates(raw: string[], fill: Record<string, number>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    const code = value.toUpperCase();
    if (!isStateCode(code) || seen.has(code)) continue;
    seen.add(code);
    if ((fill[code] ?? 0) >= AD_SLOTS_PER_STATE) continue;
    out.push(code);
    if (out.length >= MAX_AD_STATES) break;
  }
  return out;
}

function toSponsored(a: {
  id: string;
  headline: string;
  body: string;
  linkUrl: string;
  vendor: { name: string; category: string; slug: string | null };
}): SponsoredAd {
  return {
    id: a.id,
    headline: a.headline,
    body: a.body,
    href: a.vendor.slug ? `/v/${a.vendor.slug}` : a.linkUrl,
    vendorName: a.vendor.name,
    category: a.vendor.category,
  };
}

const AD_INCLUDE = { vendor: { select: { name: true, category: true, slug: true } } } as const;

/**
 * Ads to show a viewer in `state` (a two-letter code), newest first, capped at
 * the per-state slot count. Passing null (unknown location) returns a
 * nationwide fill of recent active ads so the row still renders.
 */
export async function activeAdsForState(
  state: string | null,
  limit = AD_SLOTS_PER_STATE,
): Promise<SponsoredAd[]> {
  const ads = await prisma.vendorAd.findMany({
    where: {
      status: "ACTIVE",
      ...(state ? { states: { some: { state: state.toUpperCase() } } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: AD_INCLUDE,
  });
  return ads.map(toSponsored);
}

/** Nationwide recent ads, regardless of targeting — used as a fallback slot fill. */
export async function activeAds(limit = AD_SLOTS_PER_STATE): Promise<SponsoredAd[]> {
  return activeAdsForState(null, limit);
}

/**
 * How many ACTIVE ads currently occupy each state's slots, so the ad editor can
 * show remaining inventory ("2 of 4 left") and flag full states. Returns a map
 * of state code → active count.
 */
export async function stateAdFill(excludeAdId?: string): Promise<Record<string, number>> {
  const rows = await prisma.vendorAdState.findMany({
    where: {
      ad: { status: "ACTIVE", ...(excludeAdId ? { id: { not: excludeAdId } } : {}) },
    },
    select: { state: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.state] = (counts[r.state] ?? 0) + 1;
  return counts;
}
