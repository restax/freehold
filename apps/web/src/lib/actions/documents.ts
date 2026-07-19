"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { confirmed, str } from "@/lib/forms";
import { deleteObject, putObject } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";
import { emitWebhook } from "@/lib/webhook-emit";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const file = formData.get("file");
  if (!transactionId || !(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_BYTES) return;

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
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

export async function deleteDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id || !confirmed(formData)) return;
  const doc = await withTenant(tenantId, (tx) =>
    tx.document.delete({ where: { id }, select: { storageKey: true, data: true } }),
  );
  await deleteObject({ storageKey: doc.storageKey, data: null });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
