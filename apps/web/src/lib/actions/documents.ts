"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { logAudit } from "@/lib/audit";
import { confirmed, str } from "@/lib/forms";
import { deleteObject, putObject } from "@/lib/storage";
import { guestMaySeeTransaction, requireTenant } from "@/lib/tenant";
import { emitWebhook } from "@/lib/webhook-emit";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadDocument(formData: FormData) {
  // Guests upload to the files they cover — that's the work — but nowhere else.
  const { tenantId, session } = await requireTenant({ allowGuest: true });
  const transactionId = str(formData, "transactionId");
  const file = formData.get("file");
  if (!transactionId || !(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_BYTES) return;
  if (!(await guestMaySeeTransaction(tenantId, session.user.id, transactionId))) return;

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = file.name || "document.pdf";
  const contentType = file.type || "application/octet-stream";
  const stored = await putObject(tenantId, filename, bytes, contentType);

  const created = await withTenant(tenantId, (tx) =>
    tx.document.create({
      data: {
        tenantId,
        transactionId,
        filename,
        contentType,
        sizeBytes: file.size,
        data: stored.data,
        storageKey: stored.storageKey,
        storageProvider: stored.storageProvider,
      },
    }),
  );
  await emitWebhook(tenantId, "document.uploaded", {
    id: created.id,
    transactionId,
    filename,
    contentType,
    sizeBytes: file.size,
  });
  logActivity({
    tenantId,
    transactionId,
    actor: session.user,
    action: "document.uploaded",
    summary: `Uploaded ${filename}`,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/**
 * Replace a document with a new file, keeping the old one as a prior version.
 * The new row becomes current (version+1, replacesId → the old); the old row's
 * bytes are kept but marked not-current so it only appears in version history.
 */
export async function replaceDocument(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const file = formData.get("file");
  if (!id || !(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return;

  const prior = await withTenant(tenantId, (tx) =>
    tx.document.findUnique({
      where: { id },
      select: {
        id: true,
        transactionId: true,
        version: true,
        isCurrent: true,
        visibleToAgent: true,
        visibleToClient: true,
      },
    }),
  );
  if (!prior?.isCurrent) return; // only current versions can be replaced

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = file.name || "document.pdf";
  const contentType = file.type || "application/octet-stream";
  const stored = await putObject(tenantId, filename, bytes, contentType);

  const created = await withTenant(tenantId, async (tx) => {
    const doc = await tx.document.create({
      data: {
        tenantId,
        transactionId: prior.transactionId,
        filename,
        contentType,
        sizeBytes: file.size,
        data: stored.data,
        storageKey: stored.storageKey,
        storageProvider: stored.storageProvider,
        visibleToAgent: prior.visibleToAgent,
        visibleToClient: prior.visibleToClient,
        version: prior.version + 1,
        replacesId: prior.id,
      },
    });
    await tx.document.update({ where: { id: prior.id }, data: { isCurrent: false } });
    return doc;
  });

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "document.replaced",
    summary: `Replaced ${filename} — v${prior.version} kept as a prior version, v${created.version} is now current`,
  });
  await emitWebhook(tenantId, "document.uploaded", {
    id: created.id,
    transactionId: prior.transactionId,
    filename,
    contentType,
    sizeBytes: file.size,
  });
  logActivity({
    tenantId,
    transactionId: prior.transactionId,
    actor: session.user,
    action: "document.replaced",
    summary: `Replaced ${filename} (now v${created.version})`,
  });
  revalidatePath(`/dashboard/transactions/${prior.transactionId}`);
}

export async function deleteDocument(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id || !confirmed(formData)) return;
  const doc = await withTenant(tenantId, async (tx) => {
    const target = await tx.document.findUniqueOrThrow({
      where: { id },
      select: {
        storageKey: true,
        data: true,
        storageProvider: true,
        tenantId: true,
        isCurrent: true,
        replacesId: true,
        filename: true,
      },
    });
    // Deleting a current version promotes the one it replaced back to current,
    // so a document never silently disappears from the list.
    if (target.isCurrent && target.replacesId) {
      await tx.document.update({ where: { id: target.replacesId }, data: { isCurrent: true } });
    }
    // Keep the chain intact: a newer row that replaced this one now points past it.
    await tx.document.updateMany({
      where: { replacesId: id },
      data: { replacesId: target.replacesId },
    });
    await tx.document.delete({ where: { id } });
    return target;
  });
  await deleteObject({
    storageKey: doc.storageKey,
    data: null,
    storageProvider: doc.storageProvider,
    tenantId: doc.tenantId,
  });
  logActivity({
    tenantId,
    transactionId,
    actor: session.user,
    action: "document.deleted",
    summary: `Deleted ${doc.filename}`,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
