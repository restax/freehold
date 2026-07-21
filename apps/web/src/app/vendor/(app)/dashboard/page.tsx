import { prisma, withVendor } from "@freehold/db";
import { Badge } from "@/components/badges";
import { vendorAcceptConnection, vendorEndConnection } from "@/lib/actions/vendor-connections";
import { fmtDate } from "@/lib/format";
import { requireVendor } from "@/lib/vendor-auth";

export const dynamic = "force-dynamic";

const btn = "rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700";
const btnGhost =
  "rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700 hover:bg-stone-50";

export default async function VendorDashboardPage() {
  const { vendorId } = await requireVendor();

  const connections = await withVendor(vendorId, (tx) =>
    tx.vendorConnection.findMany({ orderBy: { updatedAt: "desc" } }),
  );
  // Coordinator names come from organization (a root table, no RLS).
  const orgs = await prisma.organization.findMany({
    where: { id: { in: connections.map((c) => c.tenantId) } },
    select: { id: true, name: true },
  });
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const label = (tenantId: string) => orgName.get(tenantId) ?? "a coordinator";

  const incoming = connections.filter(
    (c) => c.status === "REQUESTED" && c.requestedBy === "TENANT",
  );
  const active = connections.filter((c) => c.status === "ACTIVE");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Orders</h1>
        <p className="mt-1 text-sm text-stone-500">
          Orders from the coordinators you work with land here.
        </p>
      </div>

      {incoming.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 font-medium">Coordinators asking to connect</h2>
          <ul className="flex flex-col gap-2">
            {incoming.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-200/70 bg-brand-50/40 px-3 py-2 text-sm"
              >
                <span className="font-medium">{label(c.tenantId)}</span>
                {c.note && <span className="text-stone-500">"{c.note}"</span>}
                <span className="ml-auto flex items-center gap-1.5">
                  <form action={vendorAcceptConnection}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className={btn}>
                      Accept
                    </button>
                  </form>
                  <form action={vendorEndConnection}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className={btnGhost}>
                      Decline
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {active.length > 0 ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 font-medium">Connected coordinators</h2>
          <ul className="flex flex-col divide-y divide-stone-100">
            {active.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="font-medium">{label(c.tenantId)}</span>
                <Badge tone="success">connected</Badge>
                <span className="text-xs text-stone-400">since {fmtDate(c.respondedAt)}</span>
                <form action={vendorEndConnection} className="ml-auto">
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="text-xs text-stone-400 hover:text-red-700">
                    Disconnect
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-stone-400">
            No orders yet — they'll appear here the moment a connected coordinator places one.
          </p>
        </section>
      ) : (
        incoming.length === 0 && (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
            <p className="font-medium text-stone-700">Nothing yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
              When a coordinator connects with you and places an order, it shows up here — no email
              thread, no re-typing. Make sure your{" "}
              <a href="/vendor/profile" className="text-brand-700 hover:underline">
                profile
              </a>{" "}
              is listed so they can find you.
            </p>
          </div>
        )
      )}
    </div>
  );
}
