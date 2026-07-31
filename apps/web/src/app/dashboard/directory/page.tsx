import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { Badge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { ListedToggle, ReminderOptOut } from "@/components/listed-toggle";
import { PendingButton } from "@/components/pending-button";
import { SectionCard } from "@/components/section-card";
import {
  saveDirectoryListing,
  setDirectoryListed,
  setDirectoryReminders,
} from "@/lib/actions/directory";
import { requestEngagement } from "@/lib/actions/engagements";
import { addState, removeState } from "@/lib/actions/states";
import {
  AVAILABILITY,
  type DirectorySort,
  filterListings,
  type ListingSource,
  PRICING_MODELS,
  readDirectoryConfig,
  SOFTWARE,
  SOURCE_LABEL,
  SPECIALIZATIONS,
  sortListings,
} from "@/lib/directory";
import { fetchPublicListings, loadFreeholdListings } from "@/lib/directory-feed";
import { getMemberRole, requireTenant } from "@/lib/tenant";
import { btn, btnGhost, card, input, label, summaryLink } from "@/lib/ui";
import { stateName, US_STATES } from "@/lib/vendor-profile";

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
    listingError?: string;
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
  const [listed, feed, engagements, org, myStates] = await Promise.all([
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
    prisma.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { directoryConfig: true },
    }),
    withTenant(tenantId, (tx) => tx.tenantState.findMany({ orderBy: { state: "asc" } })),
  ]);
  const myCfg = readDirectoryConfig(org.directoryConfig);
  const myListed = myCfg.listed === true;
  const coveredStates = new Set(myStates.map((s) => s.state.toUpperCase()));
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Coordinator directory</h1>
        <p className="text-sm text-stone-500">
          Find a coordinator to cover overflow or a vacation.{" "}
          <strong className="font-medium text-stone-700">Freehold Enabled</strong> workspaces run
          Freehold, so a file can be handed straight to them.{" "}
          <strong className="font-medium text-stone-700">Public Directory</strong> listings come
          from FindTCPros — contact them on their profile.
        </p>
      </div>

      {isAdmin && (
        <SectionCard
          title="Your listing"
          action={
            !myListed ? (
              <ReminderOptOut
                action={setDirectoryReminders}
                defaultChecked={myCfg.remindersOff === true}
              />
            ) : null
          }
        >
          {/* Gated on the condition still being true, not just on the param
              being present: the refusal rides in the URL, so a banner that
              only checked for it would linger after the state was added. */}
          {params.listingError && myStates.length === 0 && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {params.listingError}
            </p>
          )}

          <form action={setDirectoryListed} className="mb-3">
            <ListedToggle listed={myListed} />
          </form>

          <p className="mb-3 text-sm text-stone-500">
            Listing publishes your workspace name, the states you cover, and whatever you enter
            below — to other workspaces and to the public directory feed. Nothing about your
            transactions, clients, or people is ever published. Switch it off any time.
          </p>

          {/* Coverage lives here rather than only in Settings: every directory
              search is filtered by state, so a listing without one can't be
              found, and sending someone to another page to fix that is how
              half-finished listings happen. */}
          <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="mb-2 text-sm font-medium text-stone-700">
              States you work in{" "}
              {myStates.length === 0 && (
                <span className="font-normal text-amber-700">— required to list</span>
              )}
            </p>
            {myStates.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {myStates.map((s) => (
                  <li key={s.id}>
                    <form action={removeState} className="inline">
                      <input type="hidden" name="id" value={s.id} />
                      <button
                        type="submit"
                        title={`Remove ${stateName(s.state)}`}
                        className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-700 transition-colors hover:border-red-300 hover:text-red-700"
                      >
                        {stateName(s.state)}
                        <span aria-hidden className="text-stone-300">
                          ×
                        </span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={addState} className="flex flex-wrap items-center gap-2">
              <select name="state" required defaultValue="" className={`${input} py-1 text-sm`}>
                <option value="" disabled>
                  Add a state…
                </option>
                {US_STATES.filter(([code]) => !coveredStates.has(code)).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-stone-600">
                <input type="checkbox" name="licenseRequired" className="accent-brand-600" />
                Requires a licensed coordinator
              </label>
              <PendingButton pendingLabel="Adding…" className={`${btnGhost} px-2.5 py-1 text-xs`}>
                Add state
              </PendingButton>
            </form>
          </div>

          <details>
            <summary className={summaryLink}>
              {myListed ? "Edit your listing details" : "Fill in your listing details"}
            </summary>
            <form action={saveDirectoryListing} className="mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className={`${label} min-w-72 flex-1`}>
                  What you want other coordinators to know
                  <input
                    name="blurb"
                    defaultValue={myCfg.blurb ?? ""}
                    className={input}
                    placeholder="Buy-side residential, 48-hour turnaround, Texas and Florida"
                  />
                </label>
                <label className={label}>
                  Contact email
                  <input
                    name="contactEmail"
                    type="email"
                    defaultValue={myCfg.contactEmail ?? ""}
                    className={input}
                  />
                </label>
                <label className={label}>
                  Years in business
                  <input
                    name="yearsExperience"
                    inputMode="numeric"
                    defaultValue={myCfg.yearsExperience ?? ""}
                    className={`${input} w-24`}
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-6">
                <fieldset>
                  <legend className="mb-1 text-sm font-medium text-stone-700">
                    Specializations
                  </legend>
                  <div className="flex flex-wrap gap-3">
                    {SPECIALIZATIONS.map((s) => (
                      <label key={s} className="flex items-center gap-1.5 text-sm text-stone-600">
                        <input
                          type="checkbox"
                          name="specializations"
                          value={s}
                          defaultChecked={myCfg.specializations?.includes(s)}
                          className="accent-brand-600"
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className={label}>
                  Availability
                  <select
                    name="availability"
                    defaultValue={myCfg.availability ?? ""}
                    className={input}
                  >
                    <option value="">—</option>
                    {AVAILABILITY.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Pricing
                  <select
                    name="pricingModel"
                    defaultValue={myCfg.pricingModel ?? ""}
                    className={input}
                  >
                    <option value="">—</option>
                    {PRICING_MODELS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset>
                <legend className="mb-1 text-sm font-medium text-stone-700">
                  Software you work in
                </legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {SOFTWARE.map((s) => (
                    <label key={s} className="flex items-center gap-1.5 text-sm text-stone-600">
                      <input
                        type="checkbox"
                        name="software"
                        value={s}
                        defaultChecked={myCfg.software?.includes(s)}
                        className="accent-brand-600"
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  name="remote"
                  defaultChecked={myCfg.remote !== false}
                  className="accent-brand-600"
                />
                Works remotely
              </label>

              <div>
                <PendingButton pendingLabel="Saving…" className={btn}>
                  Save listing
                </PendingButton>
              </div>
            </form>
          </details>
        </SectionCard>
      )}

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
