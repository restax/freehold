import { prisma } from "@freehold/db";
import { adPriceConfigured, billingEnabled } from "@freehold/ee-billing";
import { notFound } from "next/navigation";
import { updateVendorProfile } from "@/lib/actions/vendor";
import { createVendorAd, openAdBilling, startTrialAd } from "@/lib/actions/vendor-ads";
import {
  addVendorCoverage,
  deleteVendorDocument,
  removeVendorCoverage,
  setVendorDocumentShare,
  uploadVendorDocument,
} from "@/lib/actions/vendor-profile";
import { fmtDate } from "@/lib/format";
import { AD_SLOTS_PER_STATE, MAX_AD_STATES, stateAdFill } from "@/lib/vendor-ads";
import { requireVendor } from "@/lib/vendor-auth";
import { coverageLabel, SUGGESTED_DOC_LABELS, US_STATES } from "@/lib/vendor-profile";

export const dynamic = "force-dynamic";

const AD_STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "In review — we'll approve it shortly", tone: "bg-amber-100 text-amber-800" },
  ACTIVE: { label: "Live in the Sponsored slots", tone: "bg-brand-600 text-white" },
  PAUSED: { label: "Paused — payment needs attention", tone: "bg-stone-200 text-stone-600" },
  REJECTED: { label: "Not approved", tone: "bg-red-100 text-red-700" },
};

const CATEGORIES: Array<[string, string]> = [
  ["TITLE", "Title / escrow"],
  ["INSPECTION", "Inspection"],
  ["PHOTOGRAPHY", "Photography"],
  ["SIGNAGE", "Sign installation"],
  ["LEGAL", "Law office"],
  ["OTHER", "Other"],
];

const KIND_LABEL: Record<string, string> = { STATE: "State", COUNTY: "County", ZIP: "ZIP" };

const field =
  "rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";
const cardClass = "rounded-2xl border border-stone-200 bg-white p-6";
const sectionTitle = "text-sm font-semibold uppercase tracking-wide text-stone-500";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function VendorProfilePage() {
  const { vendorId } = await requireVendor();
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      coverage: { orderBy: [{ kind: "asc" }, { value: "asc" }] },
      documents: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!vendor) notFound();
  const ad = await prisma.vendorAd.findFirst({
    where: { vendorId },
    include: { states: { select: { state: true } } },
  });
  const adsAvailable = billingEnabled() && adPriceConfigured();
  // Remaining inventory per state (active ads elsewhere), so the picker can show
  // "2 of 4 left" and lock states whose slots are sold.
  const fill = adsAvailable ? await stateAdFill(ad?.id) : {};
  const adStates = new Set(ad?.states.map((s) => s.state) ?? []);

  // Free-trial lifecycle for the ad panel.
  const now = Date.now();
  const paid = Boolean(ad?.periodEnd && ad.periodEnd.getTime() > now);
  const onTrial = Boolean(ad?.trialEndsAt && ad.trialEndsAt.getTime() > now && !paid);
  const trialEnded = Boolean(
    ad?.trialEndsAt && ad.trialEndsAt.getTime() <= now && !paid && !ad.stripeSubscriptionId,
  );
  const trialDaysLeft = ad?.trialEndsAt
    ? Math.max(0, Math.ceil((ad.trialEndsAt.getTime() - now) / (24 * 3600 * 1000)))
    : 0;
  // New advertisers and trial vendors save through the no-card trial path;
  // everyone else (converting or already paying) goes through billing.
  const adFormAction = !ad || onTrial ? startTrialAd : createVendorAd;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">Profile</h1>
      <p className="mb-6 text-sm text-stone-500">
        What coordinators, and their clients, see when they work with you.
        {vendor.slug && (
          <>
            {" "}
            Your public page:{" "}
            <a href={`/v/${vendor.slug}`} className="font-medium text-brand-700 hover:underline">
              /v/{vendor.slug}
            </a>
          </>
        )}
      </p>

      {/* One form for every tier of profile field — grouped so a vendor always
          knows who sees each thing. */}
      <form action={updateVendorProfile} className={`flex flex-col gap-5 ${cardClass}`}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Business name
            <input name="name" required defaultValue={vendor.name} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Category
            <select name="category" defaultValue={vendor.category} className={field}>
              {CATEGORIES.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Service area (free text — a quick summary)
            <input name="serviceArea" defaultValue={vendor.serviceArea ?? ""} className={field} />
          </label>
        </div>

        {/* Public tier */}
        <fieldset className="flex flex-col gap-4 border-t border-stone-100 pt-5">
          <legend className={sectionTitle}>
            Public — shown on your page, the directory, and ads
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Public phone
              <input
                name="publicPhone"
                defaultValue={vendor.publicPhone ?? vendor.phone ?? ""}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Public email
              <input
                name="publicEmail"
                type="email"
                defaultValue={vendor.publicEmail ?? ""}
                className={field}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Public bio
            <textarea
              name="publicBio"
              rows={3}
              defaultValue={vendor.publicBio ?? vendor.blurb ?? ""}
              placeholder="A few lines: what you offer, turnaround, coverage — anything a coordinator scanning the directory should know."
              className={field}
            />
          </label>
        </fieldset>

        {/* Client-facing tier */}
        <fieldset className="flex flex-col gap-4 border-t border-stone-100 pt-5">
          <legend className={sectionTitle}>
            Client-facing — shown to a coordinator's client on an order
          </legend>
          <label className="flex flex-col gap-1 text-sm">
            Client phone
            <input name="clientPhone" defaultValue={vendor.clientPhone ?? ""} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Client bio
            <textarea
              name="clientBio"
              rows={2}
              defaultValue={vendor.clientBio ?? ""}
              placeholder="How you introduce yourself to a buyer or seller you'll be working with."
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Service notes for clients
            <textarea
              name="clientServiceNotes"
              rows={2}
              defaultValue={vendor.clientServiceNotes ?? ""}
              placeholder="What to expect, how to prepare, scheduling notes — shown when a client places an order with you."
              className={field}
            />
          </label>
        </fieldset>

        {/* Private tier */}
        <fieldset className="flex flex-col gap-4 border-t border-stone-100 pt-5">
          <legend className={sectionTitle}>Private — never shown to anyone</legend>
          <label className="flex flex-col gap-1 text-sm">
            Private email (for our notices only)
            <input
              name="privateEmail"
              type="email"
              defaultValue={vendor.privateEmail ?? ""}
              className={field}
            />
          </label>
        </fieldset>

        <label className="flex items-start gap-2 border-t border-stone-100 pt-5 text-sm text-stone-700">
          <input
            type="checkbox"
            name="listed"
            value="1"
            defaultChecked={vendor.listed}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span>
            List me in the coordinator directory so new coordinators can find and connect with me.
          </span>
        </label>
        <div>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Save profile
          </button>
        </div>
      </form>

      {/* Coverage areas */}
      <section className={`mt-8 ${cardClass}`}>
        <h2 className="font-semibold">Where you work</h2>
        <p className="mb-4 text-sm text-stone-500">
          Add the states, counties, or ZIP codes you cover. Coordinators filter the directory by
          these, and it's how your ads reach viewers in the right place.
        </p>

        {vendor.coverage.length > 0 ? (
          <ul className="mb-4 flex flex-wrap gap-2">
            {vendor.coverage.map((c) => (
              <li key={c.id}>
                <form action={removeVendorCoverage}>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    className="group inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 py-1 pl-3 pr-2 text-sm text-stone-700 hover:border-red-200 hover:bg-red-50"
                    title="Remove"
                  >
                    <span className="text-xs font-medium uppercase text-stone-400">
                      {KIND_LABEL[c.kind] ?? c.kind}
                    </span>
                    {coverageLabel(c.kind, c.value)}
                    <span className="text-stone-400 group-hover:text-red-500">×</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-stone-400">No coverage areas yet.</p>
        )}

        <form action={addVendorCoverage} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1 text-sm">
            Type
            <select name="kind" defaultValue="STATE" className={field}>
              <option value="STATE">State</option>
              <option value="COUNTY">County</option>
              <option value="ZIP">ZIP code</option>
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Area
            <input
              name="value"
              list="state-codes"
              placeholder="e.g. IL, or Cook County, IL, or 60614"
              className={field}
            />
            <datalist id="state-codes">
              {US_STATES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </datalist>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
          >
            Add
          </button>
        </form>
      </section>

      {/* Shareable documents */}
      <section className={`mt-8 ${cardClass}`}>
        <h2 className="font-semibold">Documents you share</h2>
        <p className="mb-4 text-sm text-stone-500">
          Upload the paperwork coordinators always ask for — insurance certificate, E&O, W-9,
          license, resume. Anything marked <strong>share on order</strong> attaches automatically
          when a coordinator places an order with you, so you're never re-emailing the same PDF.
        </p>

        {vendor.documents.length > 0 ? (
          <ul className="mb-5 divide-y divide-stone-100 rounded-lg border border-stone-100">
            {vendor.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-800">{d.label}</p>
                  <p className="truncate text-xs text-stone-400">
                    {d.filename} · {formatBytes(d.sizeBytes)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <form action={setVendorDocumentShare}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="shareOnOrder" value={d.shareOnOrder ? "0" : "1"} />
                    <button
                      type="submit"
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        d.shareOnOrder
                          ? "bg-brand-600/10 text-brand-700 hover:bg-brand-600/20"
                          : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                      }`}
                      title="Toggle whether this attaches to new orders"
                    >
                      {d.shareOnOrder ? "Shares on order" : "Not shared"}
                    </button>
                  </form>
                  <form action={deleteVendorDocument}>
                    <input type="hidden" name="id" value={d.id} />
                    <button
                      type="submit"
                      className="text-xs text-stone-400 hover:text-red-600"
                      title="Delete"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-5 text-sm text-stone-400">No documents yet.</p>
        )}

        <form action={uploadVendorDocument} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Label
              <input
                name="label"
                list="doc-labels"
                placeholder="e.g. Insurance certificate"
                className={field}
              />
              <datalist id="doc-labels">
                {SUGGESTED_DOC_LABELS.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              File (PDF or image, up to 10 MB)
              <input
                name="file"
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              name="shareOnOrder"
              value="1"
              defaultChecked
              className="h-4 w-4 accent-brand-600"
            />
            Attach this automatically when a coordinator places an order
          </label>
          <div>
            <button
              type="submit"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
            >
              Upload document
            </button>
          </div>
        </form>
      </section>

      <section className={`mt-8 ${cardClass}`}>
        <div className="mb-1 flex items-center gap-2">
          <h2 className="font-semibold">Advertise here</h2>
          {ad && (
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${AD_STATUS[ad.status]?.tone ?? ""}`}
            >
              {AD_STATUS[ad.status]?.label ?? ad.status}
            </span>
          )}
        </div>
        <p className="mb-4 text-sm text-stone-500">
          A Sponsored spot on the coordinator directory and the vendors page, shown to coordinators
          in the states you pick — clearly labelled as advertising.{" "}
          {!ad && "New here? Your first 3 months are free, no card required."} Freehold reviews
          every ad before it goes live.
        </p>

        {ad?.status === "REJECTED" && ad.reviewNote && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Not approved: {ad.reviewNote}
          </p>
        )}

        {adsAvailable && onTrial && ad?.trialEndsAt && (
          <p className="mb-4 rounded-lg bg-brand-600/10 px-3 py-2 text-sm text-brand-800">
            Free trial — {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left, ends{" "}
            {fmtDate(ad.trialEndsAt)}. No card yet; set up billing any time to keep it running
            after.
          </p>
        )}
        {adsAvailable && trialEnded && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Your free trial has ended and the ad is paused. Set up billing to put it back in the
            Sponsored slots.
          </p>
        )}

        {adsAvailable ? (
          <>
            <form action={adFormAction} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Headline
                <input
                  name="headline"
                  required
                  maxLength={80}
                  defaultValue={ad?.headline ?? ""}
                  placeholder="Fast, accurate title work in Cook County"
                  className={field}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Body
                <textarea
                  name="body"
                  required
                  rows={2}
                  maxLength={200}
                  defaultValue={ad?.body ?? ""}
                  placeholder="One or two lines about what you offer."
                  className={field}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Link
                <input
                  name="linkUrl"
                  required
                  type="url"
                  defaultValue={ad?.linkUrl ?? ""}
                  placeholder="https://your-site.com"
                  className={field}
                />
              </label>

              <fieldset className="flex flex-col gap-2 text-sm">
                <legend className="mb-1 font-medium">
                  Where it shows — pick up to {MAX_AD_STATES} states
                </legend>
                <p className="text-xs text-stone-500">
                  Your ad appears to coordinators in the states you choose. Each state has{" "}
                  {AD_SLOTS_PER_STATE} slots; full states are locked until one opens up.
                </p>
                <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-1.5 sm:grid-cols-4">
                  {US_STATES.map(([code, name]) => {
                    const taken = fill[code] ?? 0;
                    const mine = adStates.has(code);
                    const left = AD_SLOTS_PER_STATE - taken;
                    const full = !mine && left <= 0;
                    return (
                      <label
                        key={code}
                        title={name}
                        className={`flex items-center gap-1.5 text-xs ${
                          full ? "text-stone-300" : "text-stone-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="state"
                          value={code}
                          defaultChecked={mine}
                          disabled={full}
                          className="h-3.5 w-3.5 accent-brand-600 disabled:opacity-40"
                        />
                        <span className="font-medium">{code}</span>
                        <span className={full ? "text-stone-300" : "text-stone-400"}>
                          {full ? "full" : `${left} left`}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  {!ad
                    ? "Start my free 3-month ad"
                    : onTrial
                      ? "Save changes"
                      : trialEnded
                        ? "Set up billing & resubmit"
                        : "Save & resubmit"}
                </button>
                {/* Convert early / skip the trial: same fields, billing path. */}
                {(!ad || onTrial) && (
                  <button
                    type="submit"
                    formAction={createVendorAd}
                    className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:border-stone-400"
                  >
                    {onTrial ? "Set up billing now" : "Skip trial — set up billing"}
                  </button>
                )}
                <span className="text-xs text-stone-400">
                  {!ad ? "No card needed — free for 3 months." : "Edits go back through review."}
                </span>
              </div>
            </form>
            {ad?.stripeCustomerId && (
              <form action={openAdBilling} className="mt-3">
                <button type="submit" className="text-xs text-brand-700 hover:underline">
                  Manage ad billing →
                </button>
              </form>
            )}
          </>
        ) : (
          <p className="text-sm text-stone-400">Advertising isn't set up on this deployment.</p>
        )}
      </section>
    </div>
  );
}
