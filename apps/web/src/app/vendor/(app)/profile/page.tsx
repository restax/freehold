import { prisma } from "@freehold/db";
import { adPriceConfigured, billingEnabled } from "@freehold/ee-billing";
import { notFound } from "next/navigation";
import { updateVendorProfile } from "@/lib/actions/vendor";
import { createVendorAd, openAdBilling } from "@/lib/actions/vendor-ads";
import { requireVendor } from "@/lib/vendor-auth";

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

const field =
  "rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";

export default async function VendorProfilePage() {
  const { vendorId } = await requireVendor();
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) notFound();
  const ad = await prisma.vendorAd.findFirst({ where: { vendorId } });
  const adsAvailable = billingEnabled() && adPriceConfigured();

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">Profile</h1>
      <p className="mb-6 text-sm text-stone-500">
        What coordinators see when they connect with you.
      </p>

      <form
        action={updateVendorProfile}
        className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6"
      >
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
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Phone
            <input name="phone" defaultValue={vendor.phone ?? ""} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Service area
            <input name="serviceArea" defaultValue={vendor.serviceArea ?? ""} className={field} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          About your business
          <textarea
            name="blurb"
            rows={3}
            defaultValue={vendor.blurb ?? ""}
            placeholder="What you offer, turnaround times, anything a coordinator should know."
            className={field}
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-stone-700">
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

      <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
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
          Buy a Sponsored spot on the coordinator directory and the vendors page — a small monthly
          fee, clearly labelled as advertising. Freehold reviews every ad before it goes live.
        </p>

        {ad?.status === "REJECTED" && ad.reviewNote && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Not approved: {ad.reviewNote}
          </p>
        )}

        {adsAvailable ? (
          <>
            <form action={createVendorAd} className="flex flex-col gap-3">
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
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  {ad ? "Save & resubmit" : "Advertise here"}
                </button>
                <span className="text-xs text-stone-400">
                  {ad ? "Edits go back through review." : "You'll set up billing next."}
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
