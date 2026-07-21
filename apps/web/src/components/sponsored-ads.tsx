import { viewerState } from "@/lib/geo";
import { AD_SLOTS_PER_STATE, activeAdsForState } from "@/lib/vendor-ads";
import { stateName } from "@/lib/vendor-profile";

/**
 * The Sponsored row. Always visibly labelled — the strip says "Sponsored" and
 * each card links to the advertiser's page. Regional: it shows the ads
 * targeting the viewer's state (from edge geo), falling back to a nationwide
 * fill when the location is unknown, and renders nothing when there are no
 * active ads. Used on the vendor directory and the /vendors marketing page;
 * never on /compare or /recommend.
 */
export async function SponsoredAds({ limit = AD_SLOTS_PER_STATE }: { limit?: number }) {
  const state = await viewerState();
  let ads = await activeAdsForState(state, limit);
  // If nobody targets this state yet, don't leave a dead row — show the
  // nationwide fill instead.
  const regional = state !== null && ads.length > 0;
  if (state !== null && ads.length === 0) ads = await activeAdsForState(null, limit);
  if (ads.length === 0) return null;

  return (
    <section aria-label="Sponsored" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Sponsored{regional && state ? ` in ${stateName(state)}` : ""}
        </span>
        <span className="h-px flex-1 bg-stone-200" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ads.map((ad) => {
          const internal = ad.href.startsWith("/");
          return (
            <a
              key={ad.id}
              href={ad.href}
              {...(internal ? {} : { target: "_blank", rel: "noreferrer nofollow sponsored" })}
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
          );
        })}
      </div>
    </section>
  );
}
