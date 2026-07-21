"use server";

import { OrderActor, VendorOrderStatus, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { str } from "@/lib/forms";
import { adminAlert } from "@/lib/notify";
import { putObject } from "@/lib/storage";
import { resolveOrderLink } from "@/lib/vendor-order-links";
import { canAcceptOrder, canComplete, canDeclineOrder, canSchedule } from "@/lib/vendor-orders";
import { emitWebhook } from "@/lib/webhook-emit";

const MAX_UPLOAD = 25 * 1024 * 1024;

/**
 * The unregistered vendor's side of an emailed order: accept / schedule /
 * complete / decline through a capability-link token, no account. The token IS
 * the capability (resolveOrderLink checks live + unexpired), and every write is
 * re-derived from the order it resolves to — a token from the form is never
 * trusted to name a tenant or order directly.
 */

async function actOnLink(
  token: string,
  gate: (s: VendorOrderStatus) => boolean,
  kind: string,
  data: Record<string, unknown>,
  extra: { at?: Date | null; detail?: string | null } = {},
) {
  const resolved = await resolveOrderLink(token);
  if (!resolved) return null;
  const { order } = resolved;
  if (!gate(order.status as VendorOrderStatus)) return null;

  await withTenant(order.tenantId, async (tx) => {
    await tx.vendorOrder.update({ where: { id: order.id }, data });
    await tx.vendorOrderEvent.create({
      data: {
        tenantId: order.tenantId,
        vendorId: order.vendorId,
        orderId: order.id,
        kind,
        actor: OrderActor.VENDOR,
        at: extra.at ?? null,
        detail: extra.detail ?? null,
      },
    });
  });
  emitWebhook(order.tenantId, "vendor.order.updated", { orderId: order.id, via: "link", kind });
  revalidatePath(`/vendor-order/${token}`);
  return resolved;
}

export async function linkAcceptOrder(formData: FormData) {
  const token = str(formData, "token");
  const r = await actOnLink(token, canAcceptOrder, "accepted", {
    status: VendorOrderStatus.ACCEPTED,
  });
  if (r) adminAlert(`✅ ${r.email} accepted the ${r.order.type} order`);
}

export async function linkScheduleOrder(formData: FormData) {
  const token = str(formData, "token");
  const when = str(formData, "scheduledAt");
  if (!when) return;
  const at = new Date(when);
  if (Number.isNaN(at.getTime())) return;
  const resolved = await resolveOrderLink(token);
  const rescheduling = resolved?.order.scheduledAt != null;
  const r = await actOnLink(
    token,
    canSchedule,
    rescheduling ? "rescheduled" : "scheduled",
    { status: VendorOrderStatus.SCHEDULED, scheduledAt: at, missedAt: null },
    { at },
  );
  if (r) adminAlert(`📅 ${r.email} scheduled the ${r.order.type} order`);
}

export async function linkCompleteOrder(formData: FormData) {
  const token = str(formData, "token");
  const r = await actOnLink(token, canComplete, "completed", {
    status: VendorOrderStatus.COMPLETED,
    completedAt: new Date(),
  });
  if (r) adminAlert(`🎉 ${r.email} marked the ${r.order.type} order complete`);
}

export async function linkDeclineOrder(formData: FormData) {
  const token = str(formData, "token");
  const reason = str(formData, "reason").trim() || null;
  const r = await actOnLink(
    token,
    canDeclineOrder,
    "declined",
    { status: VendorOrderStatus.DECLINED },
    { detail: reason },
  );
  if (r) adminAlert(`🚫 ${r.email} declined the ${r.order.type} order`);
}

/** Unregistered vendor posts a message on the order conversation. */
export async function linkSendMessage(formData: FormData) {
  const token = str(formData, "token");
  const body = str(formData, "body").trim();
  if (!body) return;
  const resolved = await resolveOrderLink(token);
  if (!resolved) return;
  const { order } = resolved;
  await withTenant(order.tenantId, (tx) =>
    tx.vendorOrderMessage.create({
      data: {
        tenantId: order.tenantId,
        vendorId: order.vendorId,
        orderId: order.id,
        authorKind: OrderActor.VENDOR,
        authorName: resolved.email,
        body,
      },
    }),
  );
  adminAlert(`💬 ${resolved.email} sent a message on the ${order.type} order`);
  revalidatePath(`/vendor-order/${token}`);
}

/** Unregistered vendor uploads a document → the coordinator's transaction. */
export async function linkUploadDoc(formData: FormData) {
  const token = str(formData, "token");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_UPLOAD) return;
  const resolved = await resolveOrderLink(token);
  if (!resolved) return;
  const { order } = resolved;

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";
  const put = await putObject(order.tenantId, file.name, bytes, contentType);

  await withTenant(order.tenantId, async (tx) => {
    await tx.document.create({
      data: {
        tenantId: order.tenantId,
        transactionId: order.transactionId,
        filename: file.name,
        contentType,
        sizeBytes: bytes.length,
        data: put.data,
        storageKey: put.storageKey,
        storageProvider: put.storageProvider,
        visibleToClient: false,
        visibleToAgent: false,
        sourceOrderId: order.id,
      },
    });
    await tx.vendorOrderMessage.create({
      data: {
        tenantId: order.tenantId,
        vendorId: order.vendorId,
        orderId: order.id,
        authorKind: OrderActor.VENDOR,
        authorName: resolved.email,
        body: `📎 Uploaded ${file.name}`,
      },
    });
  });
  adminAlert(`📎 ${resolved.email} uploaded ${file.name} on the ${order.type} order`);
  revalidatePath(`/vendor-order/${token}`);
}
