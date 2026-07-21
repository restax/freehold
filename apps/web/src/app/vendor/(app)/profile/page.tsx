import { prisma } from "@freehold/db";
import { notFound } from "next/navigation";
import { updateVendorProfile } from "@/lib/actions/vendor";
import { requireVendor } from "@/lib/vendor-auth";

export const dynamic = "force-dynamic";

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
    </div>
  );
}
