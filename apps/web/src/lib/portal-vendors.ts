import { prisma, withTenant } from "@freehold/db";

/**
 * The client-facing slice of vendor orders for one transaction: enough to place
 * a new order with a connected vendor and to watch the status and appointment of
 * existing ones. Read tenant-scoped (the portal already resolved the tenant from
 * its token); a client only ever sees their own transaction's orders because the
 * query is pinned to that transactionId.
 */

export interface PortalVendorOrder {
  id: string;
  type: string;
  status: string;
  vendorName: string | null;
  scheduledAt: Date | null;
  dueDate: Date | null;
  missedAt: Date | null;
  placedByClient: boolean;
}

export interface PortalVendorData {
  orders: PortalVendorOrder[];
  connectedVendors: Array<{ id: string; name: string; category: string }>;
}

export async function portalVendorData(
  tenantId: string,
  transactionId: string,
): Promise<PortalVendorData> {
  const [orders, connections] = await withTenant(tenantId, async (tx) => [
    await tx.vendorOrder.findMany({
      where: { transactionId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        vendorId: true,
        scheduledAt: true,
        dueDate: true,
        missedAt: true,
        placedBy: true,
      },
    }),
    await tx.vendorConnection.findMany({
      where: { status: "ACTIVE" },
      select: { vendorId: true },
    }),
  ]);

  const vendorIds = [
    ...new Set([
      ...orders.map((o) => o.vendorId).filter((v): v is string => Boolean(v)),
      ...connections.map((c) => c.vendorId),
    ]),
  ];
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, name: true, category: true },
  });
  const nameOf = new Map(vendors.map((v) => [v.id, v.name]));

  return {
    orders: orders.map((o) => ({
      id: o.id,
      type: o.type,
      status: o.status,
      vendorName: o.vendorId ? (nameOf.get(o.vendorId) ?? null) : null,
      scheduledAt: o.scheduledAt,
      dueDate: o.dueDate,
      missedAt: o.missedAt,
      placedByClient: o.placedBy === "CLIENT",
    })),
    connectedVendors: vendors.filter((v) => connections.some((c) => c.vendorId === v.id)),
  };
}
