"use server";

import { randomBytes } from "node:crypto";
import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { confirmed, str } from "@/lib/forms";
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

/**
 * Portal sign-ins are toggled, never lost: deactivating stamps revokedAt (the
 * link 404s instantly), reactivating clears it and the same URL works again.
 */
export async function setPortalLinkActive(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const active = str(formData, "active") === "1";
  if (!id) return;
  const link = await withTenant(tenantId, (tx) =>
    tx.portalLink.update({
      where: { id },
      data: { revokedAt: active ? null : new Date() },
      select: { label: true, transactionId: true },
    }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: active ? "portal.activated" : "portal.deactivated",
    summary: `${active ? "Activated" : "Deactivated"} portal access "${link.label}"`,
    subjectType: "portal_link",
    subjectId: id,
  });
  revalidatePath(`/dashboard/transactions/${link.transactionId}`);
  revalidatePath("/dashboard/clients");
}

export async function deletePortalLink(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id || !confirmed(formData)) return;
  const gone = await withTenant(tenantId, (tx) =>
    tx.portalLink.delete({ where: { id }, select: { label: true } }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "portal.deleted",
    summary: `Deleted portal access "${gone.label}"`,
    subjectType: "portal_link",
    subjectId: id,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/clients");
}
