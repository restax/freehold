import { prisma } from "@freehold/db";

/**
 * The placement read: only ACTIVE (operator-approved, paid) ads, and only for
 * the Sponsored slots. Deliberately never called from /compare or /recommend —
 * those pages carry the "nobody is paid to recommend Freehold" promise and stay
 * unpaid. Ads are a vendor buying visibility, clearly labelled, which is a
 * different thing; keeping them off those two pages is what keeps it honest.
 */

export interface SponsoredAd {
  id: string;
  headline: string;
  body: string;
  linkUrl: string;
  vendorName: string;
  category: string;
}

export async function activeAds(limit = 3): Promise<SponsoredAd[]> {
  const ads = await prisma.vendorAd.findMany({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: { vendor: { select: { name: true, category: true } } },
  });
  return ads.map((a) => ({
    id: a.id,
    headline: a.headline,
    body: a.body,
    linkUrl: a.linkUrl,
    vendorName: a.vendor.name,
    category: a.vendor.category,
  }));
}
