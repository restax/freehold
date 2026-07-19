"use server";

import { randomBytes } from "node:crypto";
import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { confirmed, optStr, str } from "@/lib/forms";
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
        showIntake: formData.get("showIntake") === "on",
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

/**
 * Managed-agent portal covering all the client's deals. Granted per agent
 * (contactId) from the client page — agents who don't want one just never
 * get a link. Links without a contactId are client-wide (legacy).
 */
export async function createAgentPortalLink(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const clientId = str(formData, "clientId");
  const contactId = optStr(formData, "contactId");
  if (!clientId) return;
  const label = await withTenant(tenantId, async (tx) => {
    let name = str(formData, "label");
    if (!name && contactId) {
      const agent = await tx.contact.findUnique({ where: { id: contactId } });
      name = agent ? `${agent.name} — portal` : "";
    }
    if (!name) return null;
    await tx.portalLink.create({
      data: {
        tenantId,
        audience: "AGENT",
        clientId,
        contactId,
        label: name,
        token: randomBytes(24).toString("base64url"),
        showDocuments: true,
      },
    });
    return name;
  });
  if (!label) return;
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "portal.agent_created",
    summary: `Created agent portal "${label}"`,
    subjectType: "client",
    subjectId: clientId,
  });
  revalidatePath(`/dashboard/clients/${clientId}`);
}

/**
 * Per-item portal visibility: the two audience toggles next to every task
 * and document on the transaction screen.
 */
export async function setItemVisibility(formData: FormData) {
  const { tenantId } = await requireTenant();
  const kind = str(formData, "kind");
  const id = str(formData, "id");
  const audience = str(formData, "audience");
  const value = str(formData, "value") === "1";
  const transactionId = str(formData, "transactionId");
  if (!id || (kind !== "task" && kind !== "document")) return;
  if (audience !== "agent" && audience !== "client") return;
  const data = audience === "agent" ? { visibleToAgent: value } : { visibleToClient: value };
  await withTenant(tenantId, async (tx) => {
    if (kind === "task") {
      await tx.task.update({ where: { id }, data });
    } else {
      await tx.document.update({ where: { id }, data });
    }
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
