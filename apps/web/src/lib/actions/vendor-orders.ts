"use server";

import {
  OrderActor,
  ProposalStatus,
  type TenantTx,
  VendorOrderStatus,
  withTenant,
  withVendor,
} from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import { dateOnly, optStr, str } from "@/lib/forms";
import { adminAlert } from "@/lib/notify";
import { getObjectBytes } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";
import { requireVendor } from "@/lib/vendor-auth";
import { createOrderLink, orderLinkUrl } from "@/lib/vendor-order-links";
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

/**
 * Email an order to a vendor who isn't on Freehold yet. The order lives on the
 * file with a null vendorId; a capability link lets them act without an account,
 * and their plain reply comes back as a reviewed proposal. This is how the
 * network starts from zero — an unregistered vendor still gets a real order.
 */
export async function emailVendorOrder(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const email = str(formData, "email").trim().toLowerCase();
  const type = str(formData, "type");
  if (!transactionId || !email.includes("@") || !type) return;

  // Gather selected transaction documents to attach (decrypted, capped 15 MB) —
  // the same loop the Emails tab uses.
  const attachDocIds = formData.getAll("attachDoc").map(String).filter(Boolean);

  const order = await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, propertyAddress: true },
    });
    if (!txn) return null;
    const o = await tx.vendorOrder.create({
      data: {
        tenantId,
        vendorId: null,
        transactionId,
        type,
        details: optStr(formData, "details"),
        dueDate: dateOnly(formData, "dueDate"),
        status: VendorOrderStatus.SENT,
        placedBy: "TC",
        emailTo: email,
      },
    });
    await recordEvent(tx, o, "created", OrderActor.TC, {
      detail: `Emailed ${type} to ${email}`,
    });
    return { ...o, property: txn.propertyAddress };
  });
  if (!order) return;

  // Build the capability link and send. If email isn't configured, the order
  // still lives on the file (the TC can share the link by hand); we never
  // silently pretend it went out.
  const token = await createOrderLink(tenantId, order.id, email);
  let sent = false;
  if (emailEnabled()) {
    try {
      const attachments: Array<{ filename: string; content: string }> = [];
      if (attachDocIds.length > 0) {
        const docs = await withTenant(tenantId, (tx) =>
          tx.document.findMany({
            where: { id: { in: attachDocIds }, transactionId },
            select: {
              filename: true,
              data: true,
              storageKey: true,
              storageProvider: true,
              tenantId: true,
            },
          }),
        );
        let total = 0;
        for (const doc of docs) {
          const bytes = await getObjectBytes(doc);
          total += bytes.length;
          if (total > 15 * 1024 * 1024) break;
          attachments.push({ filename: doc.filename, content: bytes.toString("base64") });
        }
      }

      const registerUrl = `${(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")}/vendor/register`;
      const lines = [
        `${session.user.name || "A transaction coordinator"} at ${session.user.email.split("@")[0]} sent you an order through Freehold.`,
        "",
        `Order: ${type}`,
        order.property ? `Property: ${order.property}` : "",
        order.details ? `Details: ${order.details}` : "",
        order.dueDate ? `Needed by: ${order.dueDate.toISOString().slice(0, 10)}` : "",
        "",
        "Accept, schedule, or update this order — no account needed:",
        orderLinkUrl(token),
        "",
        "Or just reply to this email and we'll turn your message into an update for the coordinator to confirm.",
        "",
        `Want every coordinator's orders in one place? Register your business (free): ${registerUrl}`,
      ].filter((l) => l !== "");

      await sendTenantEmail({
        tenantId,
        transactionId,
        orderId: order.id,
        to: email,
        subject: `${type} — order from your transaction coordinator`,
        body: lines.join("\n"),
        attachments,
      });
      sent = true;
    } catch (err) {
      adminAlert(`⚠️ Failed to email a vendor order to ${email}: ${String(err).slice(0, 200)}`);
    }
  }

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "vendor.order_emailed",
    summary: `Emailed a ${type} order to ${email}${sent ? "" : " (send pending — email not configured)"}`,
    subjectType: "VendorOrder",
    subjectId: order.id,
  });
  emitWebhook(tenantId, "vendor.order.placed", { transactionId, type, emailTo: email });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/**
 * Apply an AI-read proposal from an emailed vendor's reply — the one-click
 * confirmation. The coordinator is the authority here, so the intended
 * transition is applied and recorded as a VENDOR-actor event (it reflects what
 * the vendor said), then the proposal is marked resolved.
 */
export async function applyVendorProposal(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id) return;

  const applied = await withTenant(tenantId, async (tx) => {
    const proposal = await tx.vendorOrderProposal.findUnique({ where: { id } });
    if (!proposal || proposal.status !== ProposalStatus.PENDING) return null;
    const order = await tx.vendorOrder.findUnique({
      where: { id: proposal.orderId },
      select: { id: true, tenantId: true, vendorId: true, type: true, scheduledAt: true },
    });
    if (!order) return null;

    switch (proposal.kind) {
      case "ACCEPT":
        await tx.vendorOrder.update({
          where: { id: order.id },
          data: { status: VendorOrderStatus.ACCEPTED },
        });
        await recordEvent(tx, order, "accepted", OrderActor.VENDOR, { detail: proposal.summary });
        break;
      case "DECLINE":
        await tx.vendorOrder.update({
          where: { id: order.id },
          data: { status: VendorOrderStatus.DECLINED },
        });
        await recordEvent(tx, order, "declined", OrderActor.VENDOR, { detail: proposal.summary });
        break;
      case "SCHEDULE":
        await tx.vendorOrder.update({
          where: { id: order.id },
          data: {
            status: VendorOrderStatus.SCHEDULED,
            scheduledAt: proposal.at,
            missedAt: null,
          },
        });
        await recordEvent(
          tx,
          order,
          order.scheduledAt ? "rescheduled" : "scheduled",
          OrderActor.VENDOR,
          { at: proposal.at, detail: proposal.summary },
        );
        break;
      case "COMPLETE":
        await tx.vendorOrder.update({
          where: { id: order.id },
          data: { status: VendorOrderStatus.COMPLETED, completedAt: new Date() },
        });
        await recordEvent(tx, order, "completed", OrderActor.VENDOR, { detail: proposal.summary });
        break;
      default:
        // NOTE / UNKNOWN: keep the record, change no state.
        await recordEvent(tx, order, "note", OrderActor.VENDOR, { detail: proposal.summary });
    }

    await tx.vendorOrderProposal.update({
      where: { id },
      data: { status: ProposalStatus.APPLIED, resolvedAt: new Date() },
    });
    return { order, kind: proposal.kind };
  });
  if (!applied) return;

  emitWebhook(tenantId, "vendor.order.updated", {
    orderId: applied.order.id,
    via: "email_reply",
    kind: applied.kind,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/** Dismiss a proposal without applying it. */
export async function dismissVendorProposal(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id) return;
  await withTenant(tenantId, (tx) =>
    tx.vendorOrderProposal.updateMany({
      where: { id, status: ProposalStatus.PENDING },
      data: { status: ProposalStatus.DISMISSED, resolvedAt: new Date() },
    }),
  );
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
