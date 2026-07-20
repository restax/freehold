import { withTenant } from "@freehold/db";
import Link from "next/link";
import { Badge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { requestEngagement } from "@/lib/actions/engagements";
import {
  type DirectorySort,
  filterListings,
  type ListingSource,
  SOFTWARE,
  SOURCE_LABEL,
  SPECIALIZATIONS,
  sortListings,
} from "@/lib/directory";
import { fetchPublicListings, loadFreeholdListings } from "@/lib/directory-feed";
import { getMemberRole, requireTenant } from "@/lib/tenant";
import { btnGhost, card, input, label } from "@/lib/ui";

export const dynamic = "force-dynamic";

const SORTS: Array<[DirectorySort, string]> = [
  ["source", "Freehold Enabled first"],
  ["name", "Name"],
  ["experience", "Most experienced"],
];

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    state?: string;
    specialization?: string;
    software?: string;
    source?: string;
    q?: string;
    sort?: string;
  }>;
}) {
  const { tenantId, userId } = await requireTenant();
  const isAdmin = ["owner", "admin"].includes(await getMemberRole(tenantId, userId));
  const params = await searchParams;
  const source: ListingSource | undefined =
    params.source === "freehold" || params.source === "public" ? params.source : undefined;
  const sort: DirectorySort =
    params.sort === "name" || params.sort === "experience" ? params.sort : "source";

  // Freehold-enabled workspaces on this instance, plus whatever the public
  // directory syndicates. The public side is a third party: if it's slow or
  // down, the page still renders with the workspaces we do have.
  const [listed, feed, engagements] = await Promise.all([
    loadFreeholdListings(),
    fetchPublicListings(),
    // Vendors we've already asked or are already working with, so the card
    // offers a link instead of a duplicate request.
    withTenant(tenantId, (tx) =>
      tx.engagement.findMany({
        where: { tenantId, status: { in: ["REQUESTED", "ACTIVE"] } },
        select: { vendorTenantId: true },
      }),
    ),
  ]);
  const engagedWith = new Set(engagements.map((e) => e.vendorTenantId));
  // Your own workspace isn't a vendor to you.
  const freeholdRows = listed.filter((l) => l.id !== tenantId);

  const all = [...freeholdRows, ...feed.listings];
  const results = sortListings(
    filterListings(all, {
      state: params.state,
      specialization: params.specialization,
      software: params.software,
      source,
      q: params.q,
    }),
    sort,
  );
  const freeholdCount = all.filter((l) => l.source === "freehold").length;
  const publicCount = all.filter((l) => l.source === "public").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Coordinator directory</h1>
        <p className="text-sm text-stone-500">
          Find a coordinator to cover overflow or a vacation.{" "}
          <strong className="font-medium text-stone-700">Freehold Enabled</strong> workspaces run
          Freehold, so a file can be handed straight to them.{" "}
          <strong className="font-medium text-stone-700">Public Directory</strong> listings come
          from FindTCPros — contact them on their profile.{" "}
          <Link href="/dashboard/settings" className="text-brand-700 hover:underline">
            List your own workspace →
          </Link>
        </p>
      </div>

      {feed.error && (
        <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600">
          {feed.error} Showing Freehold workspaces only.
        </p>
      )}

      <form className={`${card} flex flex-wrap items-end gap-3`}>
        <label className={label}>
          Search
          <input
            name="q"
            defaultValue={params.q ?? ""}
            className={input}
            placeholder="Name or focus"
          />
        </label>
        <label className={label}>
          State
          <input
            name="state"
            maxLength={2}
            defaultValue={params.state ?? ""}
            className={`${input} w-20`}
            placeholder="TX"
          />
        </label>
        <label className={label}>
          Specialization
          <select
            name="specialization"
            defaultValue={params.specialization ?? ""}
            className={input}
          >
            <option value="">Any</option>
            {SPECIALIZATIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Software
          <select name="software" defaultValue={params.software ?? ""} className={input}>
            <option value="">Any</option>
            {SOFTWARE.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Source
          <select name="source" defaultValue={params.source ?? ""} className={input}>
            <option value="">Both ({all.length})</option>
            <option value="freehold">Freehold Enabled ({freeholdCount})</option>
            <option value="public">Public Directory ({publicCount})</option>
          </select>
        </label>
        <label className={label}>
          Sort by
          <select name="sort" defaultValue={sort} className={input}>
            {SORTS.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={btnGhost}>
          Apply
        </button>
      </form>

      {results.length === 0 ? (
        <EmptyState
          title="No coordinators match"
          hint={
            all.length === 0
              ? "No workspaces have listed themselves yet, and no public directory is connected."
              : "Widen the filters — try clearing the state or specialization."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((l) => (
            <article key={`${l.source}-${l.id}`} className={card}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{l.name}</h2>
                <Badge tone={l.source === "freehold" ? "success" : "neutral"}>
                  {SOURCE_LABEL[l.source]}
                </Badge>
                {l.verified && l.source === "public" && <Badge tone="progress">Verified</Badge>}
              </div>
              <p className="text-sm text-stone-500">
                {[
                  l.city,
                  l.states.length > 0 ? l.states.join(", ") : null,
                  l.remote ? "Remote" : null,
                  l.yearsExperience != null ? `${l.yearsExperience} yrs` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No coverage listed"}
              </p>
              {l.blurb && <p className="mt-1.5 text-sm text-stone-600">{l.blurb}</p>}
              {(l.specializations.length > 0 || l.software.length > 0) && (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {[...l.specializations, ...l.software].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600"
                    >
                      {tag}
                    </span>
                  ))}
                </p>
              )}
              <p className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {l.rating != null && (
                  <span className="text-stone-500">
                    {l.rating.toFixed(1)}
                    {l.reviewCount != null ? ` (${l.reviewCount})` : ""}
                  </span>
                )}
                {l.availability && <span className="text-stone-500">{l.availability}</span>}
                {l.pricingModel && <span className="text-stone-500">{l.pricingModel}</span>}
                {l.contactEmail && (
                  <a
                    href={`mailto:${l.contactEmail}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Contact
                  </a>
                )}
                {l.engageable &&
                  isAdmin &&
                  (engagedWith.has(l.id) ? (
                    <Link
                      href="/dashboard/engagements"
                      className="ml-auto text-xs text-stone-500 hover:underline"
                    >
                      already engaged →
                    </Link>
                  ) : (
                    <form action={requestEngagement} className="ml-auto flex items-center gap-1">
                      <input type="hidden" name="vendorTenantId" value={l.id} />
                      <input
                        name="note"
                        placeholder="What you need covered"
                        className={`${input} w-44 px-2 py-1 text-xs`}
                      />
                      <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                        Request coverage
                      </button>
                    </form>
                  ))}
                {l.profileUrl && (
                  <a
                    href={l.profileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="ml-auto font-medium text-brand-700 hover:underline"
                  >
                    View profile →
                  </a>
                )}
              </p>
            </article>
          ))}
        </div>
      )}

      <p className="text-xs text-stone-400">
        Showing {results.length} of {all.length} — {freeholdCount} Freehold Enabled, {publicCount}{" "}
        from the public directory
        {!feed.configured && " (no public directory connected)"}.
      </p>
    </div>
  );
}
