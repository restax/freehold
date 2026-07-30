"use server";

import { DateAnchor, TaskPriority, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { confirmed, intOr, oneOf, optStr, str } from "@/lib/forms";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

const ANCHORS = Object.values(DateAnchor);
const PRIORITIES = Object.values(TaskPriority);

export async function createPlan(formData: FormData) {
  const { tenantId } = await requireTenant();
  const name = str(formData, "name");
  if (!name) return;
  const created = await withTenant(tenantId, (tx) =>
    tx.actionPlan.create({
      data: {
        tenantId,
        name,
        description: optStr(formData, "description"),
        groupId: optStr(formData, "groupId"),
      },
    }),
  );
  revalidatePath("/dashboard/templates");
  redirect(`/dashboard/action-plans/${created.id}`);
}

export async function deletePlan(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const id = str(formData, "id");
  if (!id || !isAdmin || !confirmed(formData)) return;
  await withTenant(tenantId, (tx) => tx.actionPlan.delete({ where: { id } }));
  revalidatePath("/dashboard/templates");
  redirect("/dashboard/templates?tab=tasks");
}

/** Move a plan into a different group (or ungroup it). */
export async function movePlanGroup(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) =>
    tx.actionPlan.update({ where: { id }, data: { groupId: optStr(formData, "groupId") } }),
  );
  revalidatePath("/dashboard/templates");
}

export async function addTemplateTask(formData: FormData) {
  const { tenantId } = await requireTenant();
  const actionPlanId = str(formData, "actionPlanId");
  const title = str(formData, "title");
  if (!actionPlanId || !title) return;
  await withTenant(tenantId, async (tx) => {
    const max = await tx.actionPlanTask.aggregate({
      where: { actionPlanId },
      _max: { sortOrder: true },
    });
    await tx.actionPlanTask.create({
      data: {
        tenantId,
        actionPlanId,
        title,
        anchor: oneOf(formData, "anchor", ANCHORS, DateAnchor.CLOSE_DATE),
        offsetDays: intOr(formData, "offsetDays", 0) ?? 0,
        emailTemplateId: optStr(formData, "emailTemplateId"),
        autoSendEmail: formData.get("autoSendEmail") === "on",
        priority: oneOf(formData, "priority", PRIORITIES, TaskPriority.NORMAL),
        reminderDays: intOr(formData, "reminderDays", null),
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
  });
  revalidatePath(`/dashboard/action-plans/${actionPlanId}`);
}

export async function updateTemplateTask(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const actionPlanId = str(formData, "actionPlanId");
  const title = str(formData, "title");
  if (!id || !title) return;
  await withTenant(tenantId, (tx) =>
    tx.actionPlanTask.update({
      where: { id },
      data: {
        title,
        anchor: oneOf(formData, "anchor", ANCHORS, DateAnchor.CLOSE_DATE),
        offsetDays: intOr(formData, "offsetDays", 0) ?? 0,
        emailTemplateId: optStr(formData, "emailTemplateId"),
        autoSendEmail: formData.get("autoSendEmail") === "on",
        priority: oneOf(formData, "priority", PRIORITIES, TaskPriority.NORMAL),
        reminderDays: intOr(formData, "reminderDays", null),
      },
    }),
  );
  revalidatePath(`/dashboard/action-plans/${actionPlanId}`);
}

/**
 * Bulk-commit a batch of trashed template tasks. The UI stages deletions
 * client-side (a row moves to a restorable "trash" list on click) and only
 * calls this — with a typed DELETE confirmation — once the user commits.
 * Nothing is destroyed by clicking delete alone.
 */
export async function deleteTemplateTasks(formData: FormData) {
  const { tenantId } = await requireTenant();
  const actionPlanId = str(formData, "actionPlanId");
  if (!actionPlanId || !confirmed(formData)) return;
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return;
  await withTenant(tenantId, (tx) =>
    tx.actionPlanTask.deleteMany({ where: { id: { in: ids }, actionPlanId } }),
  );
  revalidatePath(`/dashboard/action-plans/${actionPlanId}`);
}

/** A document this plan expects on the file. Applying the plan seeds the
 *  transaction's required-documents checklist from these. */
export async function addTemplateDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const actionPlanId = str(formData, "actionPlanId");
  const label = str(formData, "label");
  if (!actionPlanId || !label) return;
  await withTenant(tenantId, async (tx) => {
    const max = await tx.actionPlanDocument.aggregate({
      where: { actionPlanId },
      _max: { sortOrder: true },
    });
    await tx.actionPlanDocument.create({
      data: { tenantId, actionPlanId, label, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
  });
  revalidatePath(`/dashboard/action-plans/${actionPlanId}`);
}

export async function deleteTemplateDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const actionPlanId = str(formData, "actionPlanId");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.actionPlanDocument.delete({ where: { id } }));
  revalidatePath(`/dashboard/action-plans/${actionPlanId}`);
}
