import { prisma, withTenant } from "@freehold/db";
import { cancelVendorOrder, placeVendorOrder } from "@/lib/actions/vendor-orders";
import { fmtDate } from "@/lib/format";
import { card } from "@/lib/ui";
import { fmtDateTime, ORDER_EVENT_LABEL, ORDER_STATUS_STYLE } from "@/lib/vendor-order-labels";

/**
 * The Vendors tab on a transaction: place orders with connected vendors and
 * watch their status and appointment history. Kept out of the giant
 * transaction page file; rendered by it under `tab === "vendors"`.
 */

const field =
  "rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";

export async function VendorOrderTab({
  tenantId,
  transactionId,
}: {
  tenantId: string;
  transactionId: string;
}) {
  const [orders, activeConnections] = await withTenant(tenantId, async (tx) => [
    await tx.vendorOrder.findMany({
      where: { transactionId },
      orderBy: { createdAt: "desc" },
      include: { events: { orderBy: { createdAt: "asc" } } },
    }),
    await tx.vendorConnection.findMany({
      where: { status: "ACTIVE" },
      select: { vendorId: true },
    }),
  ]);

  // Vendor names (root table, no RLS) for both the order rows and the picker.
  const vendorIds = [
    ...new Set([
      ...orders.map((o) => o.vendorId).filter((v): v is string => Boolean(v)),
      ...activeConnections.map((c) => c.vendorId),
    ]),
  ];
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, name: true },
  });
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
  const connectable = vendors.filter((v) => activeConnections.some((c) => c.vendorId === v.id));

  return (
    <div className="flex flex-col gap-6">
      <section className={card}>
        <h3 className="mb-1 font-medium">Order a vendor</h3>
        {connectable.length === 0 ? (
          <p className="text-sm text-stone-500">
            No connected vendors yet. Connect with vendors on the{" "}
            <a href="/dashboard/vendors" className="text-brand-700 hover:underline">
              Vendors
            </a>{" "}
            page, then order them here.
          </p>
        ) : (
          <form action={placeVendorOrder} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="transactionId" value={transactionId} />
            <label className="flex flex-col gap-1 text-sm">
              Vendor
              <select name="vendorId" required className={field}>
                {connectable.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              What you need
              <input name="type" required placeholder="Title commitment" className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Needed by
              <input name="dueDate" type="date" className={field} />
            </label>
            <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
              Details
              <input
                name="details"
                placeholder="Anything the vendor should know"
                className={field}
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Send order
            </button>
          </form>
        )}
      </section>

      {orders.length === 0 ? (
        <p className="text-sm text-stone-400">No vendor orders on this file yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o) => (
            <section key={o.id} className={card}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{o.type}</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLE[o.status] ?? ""}`}
                >
                  {o.status.toLowerCase()}
                </span>
                <span className="text-sm text-stone-500">
                  {o.vendorId ? (vendorName.get(o.vendorId) ?? "vendor") : "by email"}
                </span>
                {o.scheduledAt && (
                  <span className="text-sm text-brand-700">
                    appointment {fmtDateTime(o.scheduledAt)}
                  </span>
                )}
                {o.dueDate && (
                  <span className="text-xs text-stone-400">needed by {fmtDate(o.dueDate)}</span>
                )}
                {o.status !== "COMPLETED" &&
                  o.status !== "CANCELLED" &&
                  o.status !== "DECLINED" && (
                    <form action={cancelVendorOrder} className="ml-auto">
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="transactionId" value={transactionId} />
                      <button type="submit" className="text-xs text-stone-400 hover:text-red-700">
                        Cancel
                      </button>
                    </form>
                  )}
              </div>
              {o.details && <p className="mt-2 text-sm text-stone-600">{o.details}</p>}

              {o.events.length > 0 && (
                <ol className="mt-3 flex flex-col gap-1 border-t border-stone-100 pt-3 text-xs text-stone-500">
                  {o.events.map((e) => (
                    <li key={e.id} className="flex flex-wrap gap-2">
                      <span className="tabular-nums text-stone-400">
                        {fmtDateTime(e.createdAt)}
                      </span>
                      <span className="font-medium text-stone-700">
                        {ORDER_EVENT_LABEL[e.kind] ?? e.kind}
                      </span>
                      {e.at && <span>for {fmtDateTime(e.at)}</span>}
                      {e.detail && <span>— {e.detail}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
