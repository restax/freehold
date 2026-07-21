"use server";

import { OrderActor, prisma, withTenant, withVendor } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import { str } from "@/lib/forms";
import { putObject } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";
import { requireVendor } from "@/lib/vendor-auth";
import { createOrderLink, orderLinkUrl } from "@/lib/vendor-order-links";

/**
 * The order conversation, both sides. Messages thread per order and are read on
 * whichever surface the party uses — the coordinator's Vendors tab, the vendor's
 * dashboard, or (for an unregistered vendor) their capability link. When the TC
 * writes to an unregistered vendor, the message also goes out by email so the
 * one conversation reaches them regardless of channel; their reply comes back
 * through the inbound webhook as another message in the same thread.
 *
 * Uploads follow the same trust discipline as everything vendor-side: prove the
 * order belongs to the vendor first (withVendor), then write the document
 * tenant-scoped (withTenant). A vendor document is internal until the TC shares.
 */

const MAX_UPLOAD = 25 * 1024 * 1024;

/** Coordinator posts a message on an order. */
export async function sendOrderMessageTC(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const orderId = str(formData, "orderId");
  const transactionId = str(formData, "transactionId");
  const body = str(formData, "body").trim();
  if (!orderId || !body) return;

  const order = await withTenant(tenantId, async (tx) => {
    const o = await tx.vendorOrder.findUnique({
      where: { id: orderId },
      select: { id: true, vendorId: true, type: true, emailTo: true, transactionId: true },
    });
    if (!o) return null;
    await tx.vendorOrderMessage.create({
      data: {
        tenantId,
        vendorId: o.vendorId,
        orderId,
        authorKind: OrderActor.TC,
        authorId: session.user.id,
        authorName: session.user.name || "Coordinator",
        body,
      },
    });
    return o;
  });
  if (!order) return;

  // Reach an unregistered vendor by email; the reply threads back on the order.
  if (!order.vendorId && order.emailTo && emailEnabled()) {
    try {
      const token = await createOrderLink(tenantId, order.id, order.emailTo);
      await sendTenantEmail({
        tenantId,
        transactionId: order.transactionId,
        orderId: order.id,
        to: order.emailTo,
        subject: `Re: ${order.type}`,
        body: `${body}\n\n—\nReply to this email, or open the order: ${orderLinkUrl(token)}`,
      });
    } catch {
      // The message still posts; email delivery is best-effort.
    }
  }
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/** Registered vendor posts a message on an order. */
export async function sendOrderMessageVendor(formData: FormData) {
  const { vendorId } = await requireVendor();
  const orderId = str(formData, "orderId");
  const body = str(formData, "body").trim();
  if (!orderId || !body) return;

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { name: true },
  });
  await withVendor(vendorId, async (tx) => {
    const o = await tx.vendorOrder.findUnique({
      where: { id: orderId },
      select: { id: true, tenantId: true, vendorId: true },
    });
    if (!o || o.vendorId !== vendorId) return;
    await tx.vendorOrderMessage.create({
      data: {
        tenantId: o.tenantId,
        vendorId,
        orderId,
        authorKind: OrderActor.VENDOR,
        authorName: vendor?.name ?? "Vendor",
        body,
      },
    });
  });
  revalidatePath("/vendor/dashboard");
}

/** Registered vendor uploads a document onto an order → the TC's transaction. */
export async function uploadOrderDocVendor(formData: FormData) {
  const { vendorId } = await requireVendor();
  const orderId = str(formData, "orderId");
  const file = formData.get("file");
  if (!orderId || !(file instanceof File) || file.size === 0 || file.size > MAX_UPLOAD) return;

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { name: true },
  });

  // Prove ownership before touching the tenant's storage or documents.
  const order = await withVendor(vendorId, (tx) =>
    tx.vendorOrder.findUnique({
      where: { id: orderId },
      select: { id: true, tenantId: true, vendorId: true, transactionId: true },
    }),
  );
  if (!order || order.vendorId !== vendorId) return;

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
        vendorId,
        orderId,
        authorKind: OrderActor.VENDOR,
        authorName: vendor?.name ?? "Vendor",
        body: `📎 Uploaded ${file.name}`,
      },
    });
  });
  revalidatePath("/vendor/dashboard");
}
