"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { createRowForDocument } from "@/lib/attachment-rows";
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

  const uploaderName = session.user.name ?? session.user.email;
  // Uploading from a row's own button fills that row; uploading from the tab's
  // Add menu has no row in mind and gets one of its own.
  const rowId = str(formData, "rowId");
  const created = await withTenant(tenantId, async (tx) => {
    const doc = await tx.document.create({
      data: {
        tenantId,
        transactionId,
        filename,
        contentType,
        sizeBytes: file.size,
        data: stored.data,
        storageKey: stored.storageKey,
        storageProvider: stored.storageProvider,
        uploadedById: session.user.id,
        uploadedByName: uploaderName,
      },
    });
    const target = rowId
      ? await tx.transactionAttachment.findFirst({
          where: { id: rowId, transactionId, documentId: null },
          select: { id: true },
        })
      : null;
    if (target) {
      await tx.transactionAttachment.update({
        where: { id: target.id },
        data: { documentId: doc.id, completedAt: new Date() },
      });
    } else {
      // Every file gets a row on the Attachments tab. Without this the file
      // would exist but appear nowhere in the list, which is exactly the split
      // between "the checklist" and "the documents" this rework removes.
      await createRowForDocument(tx, {
        tenantId,
        transactionId,
        documentId: doc.id,
        label: filename,
        createdById: session.user.id,
        createdByName: uploaderName,
      });
    }
    return doc;
  });
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
        uploadedById: session.user.id,
        uploadedByName: session.user.name ?? session.user.email,
      },
    });
    await tx.document.update({ where: { id: prior.id }, data: { isCurrent: false } });
    // A new version is the same attachment, so the row follows the file
    // forward — leaving it on the superseded version would empty the row and
    // reopen a slot that was just satisfied.
    await tx.transactionAttachment.updateMany({
      where: { documentId: prior.id },
      data: { documentId: doc.id },
    });
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
    // so a document never silently disappears from the list. Its row follows
    // it back: SetNull alone would empty the row and strand the restored
    // version outside the list it just rejoined.
    if (target.isCurrent && target.replacesId) {
      await tx.document.update({ where: { id: target.replacesId }, data: { isCurrent: true } });
      await tx.transactionAttachment.updateMany({
        where: { documentId: id },
        data: { documentId: target.replacesId },
      });
    }
    // Keep the chain intact: a newer row that replaced this one now points past it.
    await tx.document.updateMany({
      where: { replacesId: id },
      data: { replacesId: target.replacesId },
    });
    // A row that exists only because this file was dropped in goes with it —
    // otherwise deleting a file leaves an empty row named after it, which
    // reads as "we're still waiting for this" when nobody ever was. A row
    // something actually expects (required, or filed in a folder, or carrying
    // notes) stays and simply empties: losing the file shouldn't lose the
    // fact that the file was asked for.
    if (!target.replacesId) {
      await tx.transactionAttachment.deleteMany({
        where: {
          documentId: id,
          required: false,
          folderId: null,
          omittedAt: null,
          notes: { none: {} },
        },
      });
    }
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
