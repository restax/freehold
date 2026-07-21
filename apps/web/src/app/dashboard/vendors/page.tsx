import { prisma, withTenant } from "@freehold/db";
import { Badge } from "@/components/badges";
import { SponsoredAds } from "@/components/sponsored-ads";
import {
  requestConnection,
  tenantAcceptConnection,
  tenantEndConnection,
} from "@/lib/actions/vendor-connections";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btn, btnGhost, card } from "@/lib/ui";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  TITLE: "Title / escrow",
  INSPECTION: "Inspection",
  PHOTOGRAPHY: "Photography",
  SIGNAGE: "Sign installation",
  LEGAL: "Law office",
  OTHER: "Other",
};

const STATUS_TONE = {
  ACTIVE: "success",
  REQUESTED: "progress",
  DECLINED: "neutral",
  REVOKED: "neutral",
} as const;

export default async function VendorsPage() {
  const { tenantId } = await requireTenant();

  const connections = await withTenant(tenantId, (tx) =>
    tx.vendorConnection.findMany({ orderBy: { updatedAt: "desc" } }),
  );
  const byVendor = new Map(connections.map((c) => [c.vendorId, c]));

  // Vendor is a root table (no RLS), read directly. Listed vendors are the
  // discovery surface; names for every connected vendor are fetched in one go.
  const [listed, connectedVendors] = await Promise.all([
    prisma.vendor.findMany({
      where: { listed: true },
      orderBy: { name: "asc" },
      take: 100,
      select: { id: true, name: true, category: true, serviceArea: true, blurb: true },
    }),
    prisma.vendor.findMany({
      where: { id: { in: connections.map((c) => c.vendorId) } },
      select: { id: true, name: true },
    }),
  ]);
  const nameOf = new Map(connectedVendors.map((v) => [v.id, v.name]));

  const incoming = connections.filter(
    (c) => c.status === "REQUESTED" && c.requestedBy === "VENDOR",
  );
  const active = connections.filter((c) => c.status === "ACTIVE");
  const pendingOut = connections.filter(
    (c) => c.status === "REQUESTED" && c.requestedBy === "TENANT",
  );

  const label = (vendorId: string) => nameOf.get(vendorId) ?? "a vendor";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Vendors</h1>
        <p className="mt-1 text-sm text-stone-500">
          Connect with the title companies, inspectors, photographers, and others you order from.
          Once connected, orders skip the email thread.
        </p>
      </div>

      <SponsoredAds />

      {incoming.length > 0 && (
        <section className={card}>
          <h2 className="mb-3 font-medium">Requests to connect</h2>
          <ul className="flex flex-col gap-2">
            {incoming.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-200/70 bg-brand-50/40 px-3 py-2 text-sm"
              >
                <span className="font-medium">{label(c.vendorId)}</span>
                {c.note && <span className="text-stone-500">"{c.note}"</span>}
                <span className="ml-auto flex items-center gap-1.5">
                  <form action={tenantAcceptConnection}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className={`${btn} px-3 py-1 text-xs`}>
                      Accept
                    </button>
                  </form>
                  <form action={tenantEndConnection}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className={`${btnGhost} px-3 py-1 text-xs`}>
                      Decline
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {active.length > 0 && (
        <section className={card}>
          <h2 className="mb-3 font-medium">Connected</h2>
          <ul className="flex flex-col divide-y divide-stone-100">
            {active.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="font-medium">{label(c.vendorId)}</span>
                <span className="text-xs text-stone-400">since {fmtDate(c.respondedAt)}</span>
                <form action={tenantEndConnection} className="ml-auto">
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="text-xs text-stone-400 hover:text-red-700">
                    Disconnect
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <h2 className="mb-1 font-medium">Find a vendor</h2>
        <p className="mb-4 text-xs text-stone-400">
          Vendors who've listed themselves. Not seeing yours? Ordering from a vendor by email — even
          before they register — is coming next; the connection forms below cover vendors already on
          Freehold.
        </p>
        {listed.length === 0 ? (
          <p className="text-sm text-stone-400">No vendors have listed themselves yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {listed.map((v) => {
              const conn = byVendor.get(v.id);
              return (
                <li
                  key={v.id}
                  className="flex flex-col gap-2 rounded-xl border border-stone-200/70 p-4"
                >
                  <div>
                    <p className="font-medium">{v.name}</p>
                    <p className="text-xs text-stone-500">
                      {CATEGORY_LABEL[v.category]}
                      {v.serviceArea ? ` · ${v.serviceArea}` : ""}
                    </p>
                  </div>
                  {v.blurb && <p className="text-sm leading-relaxed text-stone-600">{v.blurb}</p>}
                  <div className="mt-auto">
                    {conn ? (
                      <Badge tone={STATUS_TONE[conn.status]}>{conn.status.toLowerCase()}</Badge>
                    ) : (
                      <form action={requestConnection}>
                        <input type="hidden" name="vendorId" value={v.id} />
                        <button type="submit" className={`${btnGhost} px-3 py-1 text-xs`}>
                          Request connection
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pendingOut.length > 0 && (
        <p className="text-xs text-stone-400">
          {pendingOut.length} request{pendingOut.length === 1 ? "" : "s"} waiting on a vendor to
          accept.
        </p>
      )}
    </div>
  );
}
