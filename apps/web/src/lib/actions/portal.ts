"use server";

import { randomBytes } from "node:crypto";
import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { str } from "@/lib/forms";
import { requireTenant } from "@/lib/tenant";

export async function createPortalLink(formData: FormData) {
  const { tenantId } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const label = str(formData, "label");
  if (!transactionId || !label) return;

  await withTenant(tenantId, (tx) =>
    tx.portalLink.create({
      data: {
        tenantId,
        transactionId,
        label,
        token: randomBytes(24).toString("base64url"),
        showTasks: formData.get("showTasks") === "on",
        showDocuments: formData.get("showDocuments") === "on",
        showParties: formData.get("showParties") === "on",
      },
    }),
  );
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

export async function revokePortalLink(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id) return;
  await withTenant(tenantId, (tx) =>
    tx.portalLink.update({ where: { id }, data: { revokedAt: new Date() } }),
  );
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

export async function deletePortalLink(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.portalLink.delete({ where: { id } }));
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
