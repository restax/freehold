"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { confirmed, optStr, str } from "@/lib/forms";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

/**
 * Compliance checklists: the set of documents a file must carry to pass
 * review. Defined once per workspace, assigned to a Client so every
 * transaction for that client inherits the same rules — and switchable off
 * per client. Distinct from action plans, which produce dated tasks.
 */

export async function createChecklist(formData: FormData) {
  const { tenantId } = await requireTenant();
  const name = str(formData, "name");
  if (!name) return;
  const created = await withTenant(tenantId, (tx) =>
    tx.complianceChecklist.create({
      data: { tenantId, name, description: optStr(formData, "description") },
    }),
  );
  revalidatePath("/dashboard/compliance");
  redirect(`/dashboard/compliance/${created.id}`);
}

export async function deleteChecklist(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const id = str(formData, "id");
  if (!id || !isAdmin || !confirmed(formData)) return;
  // Clients pointing at this checklist fall back to no rules (FK is SET NULL).
  await withTenant(tenantId, (tx) => tx.complianceChecklist.delete({ where: { id } }));
  revalidatePath("/dashboard/compliance");
  redirect("/dashboard/compliance");
}

export async function addChecklistItem(formData: FormData) {
  const { tenantId } = await requireTenant();
  const checklistId = str(formData, "checklistId");
  const name = str(formData, "name");
  if (!checklistId || !name) return;
  await withTenant(tenantId, async (tx) => {
    const max = await tx.complianceItem.aggregate({
      where: { checklistId },
      _max: { sortOrder: true },
    });
    await tx.complianceItem.create({
      data: {
        tenantId,
        checklistId,
        name,
        description: optStr(formData, "description"),
        // Unchecked "required" means the document is tracked but never blocks.
        required: formData.get("required") === "on",
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
  });
  revalidatePath(`/dashboard/compliance/${checklistId}`);
}

export async function deleteChecklistItem(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const checklistId = str(formData, "checklistId");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.complianceItem.delete({ where: { id } }));
  revalidatePath(`/dashboard/compliance/${checklistId}`);
}

/**
 * Assign (or clear) a client's checklist and switch compliance on/off for
 * them. Admin-only: these rules govern what every file for the client must
 * carry, so turning them off is an owner-level decision and is audited.
 */
export async function setClientCompliance(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const clientId = str(formData, "clientId");
  if (!clientId) return;
  const enabled = formData.get("enabled") === "on";
  const checklistId = optStr(formData, "checklistId");

  const client = await withTenant(tenantId, (tx) =>
    tx.client.update({
      where: { id: clientId },
      data: { complianceEnabled: enabled, complianceChecklistId: checklistId },
      select: { name: true, complianceChecklist: { select: { name: true } } },
    }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "compliance.client_rules_changed",
    summary: enabled
      ? `Compliance ON for ${client.name}${
          client.complianceChecklist
            ? ` — checklist "${client.complianceChecklist.name}"`
            : " — no checklist assigned"
        }`
      : `Compliance switched OFF for ${client.name}`,
  });
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/compliance");
}
