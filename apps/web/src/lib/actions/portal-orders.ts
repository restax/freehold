"use server";

import { OrderActor, VendorOrderStatus, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { optStr, str } from "@/lib/forms";
import { adminAlert } from "@/lib/notify";
import { resolvePortal } from "@/lib/portal";
import { emitWebhook } from "@/lib/webhook-emit";

/**
 * A client places an order with one of the workspace's connected vendors from
 * their portal. It lands in the coordinator's system already on the file, marked
 * placedBy CLIENT — the coordinator is notified, not asked to approve; the point
 * is removing them from the middle, not adding a gate. Token-gated the same way
 * as everything portal-side: resolve the capability first, then scope to its
 * tenant; a vendorId from the request is honored only if it's an ACTIVE
 * connection of that workspace.
 */
export async function placeClientOrder(formData: FormData) {
  const token = str(formData, "token");
  const portal = await resolvePortal(token);
  if (!portal?.link.showVendorOrders) return;
  const { link, txn } = portal;
  const vendorId = str(formData, "vendorId");
  const type = str(formData, "type");
  if (!vendorId || !type) return;

  const placed = await withTenant(link.tenantId, async (tx) => {
    const conn = await tx.vendorConnection.findUnique({
      where: { tenantId_vendorId: { tenantId: link.tenantId, vendorId } },
      select: { id: true, status: true },
    });
    if (conn?.status !== "ACTIVE") return null;
    const order = await tx.vendorOrder.create({
      data: {
        tenantId: link.tenantId,
        vendorId,
        transactionId: txn.id,
        connectionId: conn.id,
        type,
        details: optStr(formData, "details"),
        status: VendorOrderStatus.SENT,
        placedBy: "CLIENT",
      },
    });
    await tx.vendorOrderEvent.create({
      data: {
        tenantId: link.tenantId,
        vendorId,
        orderId: order.id,
        kind: "created",
        actor: OrderActor.CLIENT,
        detail: `Client ordered ${type}`,
      },
    });
    return order;
  });
  if (!placed) return;

  logAudit({
    tenantId: link.tenantId,
    action: "vendor.order_client_placed",
    summary: `A client placed a ${type} order from the portal`,
    subjectType: "VendorOrder",
    subjectId: placed.id,
  });
  adminAlert(`🧑 A client ordered a ${type} from the portal`);
  emitWebhook(link.tenantId, "vendor.order.placed", {
    transactionId: txn.id,
    type,
    placedBy: "CLIENT",
  });
  revalidatePath(`/portal/${token}`);
}
