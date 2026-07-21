import { activeAds } from "@/lib/vendor-ads";

/**
 * The Sponsored slot. Always visibly labelled — the card says "Sponsored" and
 * links out to the advertiser. Renders nothing when there are no active ads, so
 * it's safe to drop onto a page unconditionally. Used on the vendor directory
 * and the /vendors marketing page; never on /compare or /recommend.
 */
export async function SponsoredAds({ limit = 3 }: { limit?: number }) {
  const ads = await activeAds(limit);
  if (ads.length === 0) return null;

  return (
    <section aria-label="Sponsored" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Sponsored
        </span>
        <span className="h-px flex-1 bg-stone-200" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ads.map((ad) => (
          <a
            key={ad.id}
            href={ad.linkUrl}
            target="_blank"
            rel="noreferrer nofollow sponsored"
            className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50/40 p-4 transition-colors hover:border-amber-300"
          >
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900">
                Ad
              </span>
              <span className="text-xs text-stone-400">{ad.vendorName}</span>
            </div>
            <h3 className="font-medium text-stone-800">{ad.headline}</h3>
            <p className="text-sm text-stone-600">{ad.body}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
