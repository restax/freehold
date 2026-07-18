"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { str } from "@/lib/forms";
import { requireTenant } from "@/lib/tenant";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — interim Postgres storage until Stage 03 (S3)

export async function uploadDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const file = formData.get("file");
  if (!transactionId || !(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_BYTES) return;

  const data = Buffer.from(await file.arrayBuffer());
  await withTenant(tenantId, (tx) =>
    tx.document.create({
      data: {
        tenantId,
        transactionId,
        filename: file.name || "document.pdf",
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        data,
      },
    }),
  );
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

export async function deleteDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.document.delete({ where: { id } }));
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
