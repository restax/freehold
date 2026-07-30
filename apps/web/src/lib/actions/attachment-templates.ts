"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { confirmed, optStr, str } from "@/lib/forms";
import { seedRequiredDocuments } from "@/lib/required-documents";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

/**
 * Standalone document checklists — reusable, and attachable to any number of
 * task-template entries. Applying one (directly, or via the entry that
 * references it) seeds TransactionRequiredDocument rows the same way
 * ActionPlanDocument always has.
 */

export async function createAttachmentTemplate(formData: FormData) {
  const { tenantId } = await requireTenant();
  const name = str(formData, "name");
  if (!name) return;
  const created = await withTenant(tenantId, (tx) =>
    tx.attachmentTemplate.create({
      data: {
        tenantId,
        name,
        description: optStr(formData, "description"),
        groupId: optStr(formData, "groupId"),
      },
    }),
  );
  revalidatePath("/dashboard/templates");
  redirect(`/dashboard/templates?tab=attachments&open=${created.id}`);
}

export async function addAttachmentTemplateItem(formData: FormData) {
  const { tenantId } = await requireTenant();
  const attachmentTemplateId = str(formData, "attachmentTemplateId");
  const label = str(formData, "label");
  if (!attachmentTemplateId || !label) return;
  await withTenant(tenantId, async (tx) => {
    const max = await tx.attachmentTemplateItem.aggregate({
      where: { attachmentTemplateId },
      _max: { sortOrder: true },
    });
    await tx.attachmentTemplateItem.create({
      data: { tenantId, attachmentTemplateId, label, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
  });
  revalidatePath("/dashboard/templates");
}

export async function deleteAttachmentTemplateItem(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.attachmentTemplateItem.delete({ where: { id } }));
  revalidatePath("/dashboard/templates");
}

export async function deleteAttachmentTemplate(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const id = str(formData, "id");
  if (!id || !isAdmin || !confirmed(formData)) return;
  await withTenant(tenantId, (tx) => tx.attachmentTemplate.delete({ where: { id } }));
  revalidatePath("/dashboard/templates");
}

/** Apply a standalone checklist directly to a transaction — the same seeding
 *  a task-template entry's attachment reference does, just triggered by
 *  hand from the Attachments tab instead of by applying a task plan. */
export async function applyAttachmentTemplate(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const attachmentTemplateId = str(formData, "attachmentTemplateId");
  if (!transactionId || !attachmentTemplateId) return;
  const { name, added } = await withTenant(tenantId, async (tx) => {
    const template = await tx.attachmentTemplate.findUniqueOrThrow({
      where: { id: attachmentTemplateId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    const added = await seedRequiredDocuments(
      tx,
      tenantId,
      transactionId,
      template.items.map((i) => i.label),
    );
    return { name: template.name, added };
  });
  logActivity({
    tenantId,
    transactionId,
    actor: session.user,
    action: "attachment_template.applied",
    summary: `Applied "${name}" — ${added} document${added === 1 ? "" : "s"} added to the checklist`,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
