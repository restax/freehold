"use server";

import { OrderActor, VendorOrderStatus, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { str } from "@/lib/forms";
import { adminAlert } from "@/lib/notify";
import { resolveOrderLink } from "@/lib/vendor-order-links";
import { canAcceptOrder, canComplete, canDeclineOrder, canSchedule } from "@/lib/vendor-orders";
import { emitWebhook } from "@/lib/webhook-emit";

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
