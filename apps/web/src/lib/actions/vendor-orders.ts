"use server";

import { OrderActor, type TenantTx, VendorOrderStatus, withTenant, withVendor } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { dateOnly, optStr, str } from "@/lib/forms";
import { adminAlert } from "@/lib/notify";
import { requireTenant } from "@/lib/tenant";
import { requireVendor } from "@/lib/vendor-auth";
import {
  canAcceptOrder,
  canCancel,
  canComplete,
  canDeclineOrder,
  canMarkMissed,
  canSchedule,
} from "@/lib/vendor-orders";
import { emitWebhook } from "@/lib/webhook-emit";

/**
 * Orders placed with connected vendors, and the vendor-side responses. Every
 * status move also appends a VendorOrderEvent — the append-only history that
 * keeps a set-then-missed appointment visible instead of overwriting it. Both
 * sides scope through their own session var (withTenant / withVendor).
 */

/** Append one history row. Runs inside whichever transaction the caller opened. */
async function recordEvent(
  tx: TenantTx,
  order: { id: string; tenantId: string; vendorId: string | null },
  kind: string,
  actor: OrderActor,
  extra: { detail?: string | null; at?: Date | null } = {},
) {
  await tx.vendorOrderEvent.create({
    data: {
      tenantId: order.tenantId,
      vendorId: order.vendorId,
      orderId: order.id,
      kind,
      actor,
      detail: extra.detail ?? null,
      at: extra.at ?? null,
    },
  });
}

// ---- Coordinator side --------------------------------------------------------

/** Place an order with a connected vendor on a transaction. */
export async function placeVendorOrder(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const vendorId = str(formData, "vendorId");
  const type = str(formData, "type");
  if (!transactionId || !vendorId || !type) return;

  await withTenant(tenantId, async (tx) => {
    // The order may only go to a vendor this workspace is actively connected to.
    const conn = await tx.vendorConnection.findUnique({
      where: { tenantId_vendorId: { tenantId, vendorId } },
      select: { id: true, status: true },
    });
    if (conn?.status !== "ACTIVE") return;

    // The transaction must belong to this workspace (RLS already guarantees it,
    // but a bad id shouldn't create a dangling order).
    const txn = await tx.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true },
    });
    if (!txn) return;

    const order = await tx.vendorOrder.create({
      data: {
        tenantId,
        vendorId,
        transactionId,
        connectionId: conn.id,
        type,
        details: optStr(formData, "details"),
        dueDate: dateOnly(formData, "dueDate"),
        status: VendorOrderStatus.SENT,
        placedBy: "TC",
      },
    });
    await recordEvent(tx, order, "created", OrderActor.TC, {
      detail: `Ordered ${type}`,
    });
  });

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "vendor.order_placed",
    summary: `Placed a ${type} order with a vendor`,
    subjectType: "VendorOrder",
  });
  emitWebhook(tenantId, "vendor.order.placed", { transactionId, type });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/** Coordinator cancels an order. */
export async function cancelVendorOrder(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id) return;

  const cancelled = await withTenant(tenantId, async (tx) => {
    const order = await tx.vendorOrder.findUnique({
      where: { id },
      select: { id: true, tenantId: true, vendorId: true, status: true, type: true },
    });
    if (!order || !canCancel(order.status)) return null;
    await tx.vendorOrder.update({
      where: { id },
      data: { status: VendorOrderStatus.CANCELLED },
    });
    await recordEvent(tx, order, "cancelled", OrderActor.TC);
    return order;
  });
  if (!cancelled) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "vendor.order_cancelled",
    summary: `Cancelled a ${cancelled.type} order`,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

// ---- Vendor side -------------------------------------------------------------

/** All vendor-side moves share this shape: prove ownership, gate, update, log. */
async function vendorMove(
  vendorId: string,
  id: string,
  gate: (s: VendorOrderStatus) => boolean,
  apply: (
    tx: TenantTx,
    order: { id: string; tenantId: string; vendorId: string | null; type: string },
  ) => Promise<void>,
) {
  return withVendor(vendorId, async (tx) => {
    const order = await tx.vendorOrder.findUnique({
      where: { id },
      select: { id: true, tenantId: true, vendorId: true, status: true, type: true },
    });
    if (!order || order.vendorId !== vendorId || !gate(order.status)) return null;
    await apply(tx, order);
    return order;
  });
}

export async function vendorAcceptOrder(formData: FormData) {
  const { vendorId } = await requireVendor();
  const id = str(formData, "id");
  if (!id) return;
  const order = await vendorMove(vendorId, id, canAcceptOrder, async (tx, o) => {
    await tx.vendorOrder.update({ where: { id }, data: { status: VendorOrderStatus.ACCEPTED } });
    await recordEvent(tx, o, "accepted", OrderActor.VENDOR);
  });
  if (order) {
    logAudit({
      tenantId: order.tenantId,
      action: "vendor.order_accepted",
      summary: `A vendor accepted the ${order.type} order`,
    });
    emitWebhook(order.tenantId, "vendor.order.updated", { orderId: id, status: "ACCEPTED" });
  }
  revalidatePath("/vendor/dashboard");
}

export async function vendorDeclineOrder(formData: FormData) {
  const { vendorId } = await requireVendor();
  const id = str(formData, "id");
  if (!id) return;
  const detail = optStr(formData, "reason");
  const order = await vendorMove(vendorId, id, canDeclineOrder, async (tx, o) => {
    await tx.vendorOrder.update({ where: { id }, data: { status: VendorOrderStatus.DECLINED } });
    await recordEvent(tx, o, "declined", OrderActor.VENDOR, { detail });
  });
  if (order) {
    logAudit({
      tenantId: order.tenantId,
      action: "vendor.order_declined",
      summary: `A vendor declined the ${order.type} order`,
    });
    emitWebhook(order.tenantId, "vendor.order.updated", { orderId: id, status: "DECLINED" });
  }
  revalidatePath("/vendor/dashboard");
}

/** Set or move the appointment. Rescheduling records a fresh event; the old one stays. */
export async function vendorScheduleOrder(formData: FormData) {
  const { vendorId } = await requireVendor();
  const id = str(formData, "id");
  const when = str(formData, "scheduledAt"); // datetime-local
  if (!id || !when) return;
  const at = new Date(when);
  if (Number.isNaN(at.getTime())) return;

  const order = await vendorMove(vendorId, id, canSchedule, async (tx, o) => {
    const current = await tx.vendorOrder.findUnique({
      where: { id },
      select: { scheduledAt: true },
    });
    const rescheduling = current?.scheduledAt != null;
    await tx.vendorOrder.update({
      where: { id },
      data: { status: VendorOrderStatus.SCHEDULED, scheduledAt: at, missedAt: null },
    });
    await recordEvent(tx, o, rescheduling ? "rescheduled" : "scheduled", OrderActor.VENDOR, { at });
  });
  if (order) {
    logAudit({
      tenantId: order.tenantId,
      action: "vendor.order_scheduled",
      summary: `A vendor scheduled the ${order.type} order`,
    });
    emitWebhook(order.tenantId, "vendor.order.updated", {
      orderId: id,
      status: "SCHEDULED",
      scheduledAt: at.toISOString(),
    });
  }
  revalidatePath("/vendor/dashboard");
}

/** Record a missed appointment — kept in history, order returns to open. */
export async function vendorMarkMissed(formData: FormData) {
  const { vendorId } = await requireVendor();
  const id = str(formData, "id");
  if (!id) return;
  const order = await vendorMove(vendorId, id, canMarkMissed, async (tx, o) => {
    // The appointment was missed; the order is workable again (needs a new time)
    // but the missed event stays on the record forever.
    await tx.vendorOrder.update({
      where: { id },
      data: { status: VendorOrderStatus.ACCEPTED, missedAt: new Date() },
    });
    await recordEvent(tx, o, "missed", OrderActor.VENDOR);
  });
  if (order) {
    logAudit({
      tenantId: order.tenantId,
      action: "vendor.order_missed",
      summary: `A ${order.type} appointment was missed`,
    });
    emitWebhook(order.tenantId, "vendor.order.updated", { orderId: id, status: "MISSED" });
  }
  revalidatePath("/vendor/dashboard");
}

export async function vendorCompleteOrder(formData: FormData) {
  const { vendorId } = await requireVendor();
  const id = str(formData, "id");
  if (!id) return;
  const order = await vendorMove(vendorId, id, canComplete, async (tx, o) => {
    await tx.vendorOrder.update({
      where: { id },
      data: { status: VendorOrderStatus.COMPLETED, completedAt: new Date() },
    });
    await recordEvent(tx, o, "completed", OrderActor.VENDOR);
  });
  if (order) {
    logAudit({
      tenantId: order.tenantId,
      action: "vendor.order_completed",
      summary: `A vendor completed the ${order.type} order`,
    });
    emitWebhook(order.tenantId, "vendor.order.completed", { orderId: id });
    adminAlert(`✅ Vendor completed a ${order.type} order`);
  }
  revalidatePath("/vendor/dashboard");
}
