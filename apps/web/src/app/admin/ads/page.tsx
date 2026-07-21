import { prisma } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { approveAd, rejectAd } from "@/lib/actions/vendor-ads";
import { fmtDate } from "@/lib/format";
import { isOperator } from "@/lib/operator";
import { card } from "@/lib/ui";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-brand-600 text-white",
  PAUSED: "bg-stone-200 text-stone-600",
  REJECTED: "bg-red-100 text-red-700",
};

/**
 * Ad moderation. Freehold's name is on whatever renders in a Sponsored slot, so
 * every ad is reviewed here before it can go ACTIVE. vendor_ad has no RLS (a
 * vendor-owned root table); this is a single bare query, gated to operators.
 */
export default async function AdminAdsPage() {
  if (!(await isOperator())) notFound();

  const ads = await prisma.vendorAd.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 200,
    include: { vendor: { select: { name: true, email: true, category: true } } },
  });
  const pending = ads.filter((a) => a.status === "PENDING");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">
          ← Admin
        </Link>
        <h1 className="text-xl font-semibold">Vendor ads</h1>
        {pending.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {pending.length} awaiting review
          </span>
        )}
      </div>

      {ads.length === 0 ? (
        <p className="text-sm text-stone-400">No vendor ads yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {ads.map((a) => {
            const paid = a.periodEnd && a.periodEnd > new Date();
            return (
              <section key={a.id} className={card}>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${TONE[a.status] ?? ""}`}
                  >
                    {a.status.toLowerCase()}
                  </span>
                  <span className="font-medium">{a.vendor.name}</span>
                  <span className="text-xs text-stone-400">{a.vendor.email}</span>
                  <span
                    className={`text-xs ${paid ? "text-brand-700" : "text-stone-400"}`}
                    title={
                      a.periodEnd
                        ? `paid through ${fmtDate(a.periodEnd)}`
                        : "no active subscription"
                    }
                  >
                    {paid ? `paid through ${fmtDate(a.periodEnd)}` : "unpaid"}
                  </span>
                </div>
                <h3 className="mt-2 font-medium text-stone-800">{a.headline}</h3>
                <p className="text-sm text-stone-600">{a.body}</p>
                <a
                  href={a.linkUrl}
                  target="_blank"
                  rel="noreferrer nofollow"
                  className="text-xs text-brand-600 hover:underline"
                >
                  {a.linkUrl}
                </a>

                {(a.status === "PENDING" || a.status === "PAUSED") && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form action={approveAd}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={rejectAd} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={a.id} />
                      <input
                        name="note"
                        placeholder="Reason (shown to vendor)"
                        className="rounded-md border border-stone-300 px-2 py-1 text-xs"
                      />
                      <button type="submit" className="text-xs text-stone-400 hover:text-red-700">
                        Reject
                      </button>
                    </form>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
