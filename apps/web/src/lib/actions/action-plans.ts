"use server";

import {
  AssigneeRole,
  DateAnchor,
  TaskKind,
  TaskPriority,
  type TenantTx,
  TransactionSide,
  withTenant,
} from "@freehold/db";
import { wouldCycle } from "@freehold/workflows";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { confirmed, intOr, oneOf, optStr, str } from "@/lib/forms";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

const ANCHORS = Object.values(DateAnchor);
const PRIORITIES = Object.values(TaskPriority);
const KINDS = Object.values(TaskKind);
const ROLES: string[] = Object.values(AssigneeRole);
const SIDES: string[] = Object.values(TransactionSide);

/** The per-entry settings shared by the add and edit forms. */
function entryFields(formData: FormData) {
  return {
    notes: optStr(formData, "notes"),
    kind: oneOf(formData, "kind", KINDS, TaskKind.TODO),
    anchor: oneOf(formData, "anchor", ANCHORS, DateAnchor.CLOSE_DATE),
    offsetDays: intOr(formData, "offsetDays", 0) ?? 0,
    // Empty = every side. Unknown values are dropped rather than rejected:
    // a stale form field shouldn't be able to scope an entry to nothing.
    sides: formData
      .getAll("sides")
      .map(String)
      .filter((s): s is TransactionSide => SIDES.includes(s)),
    assigneeRole: roleOrNull(formData),
    milestone: formData.get("milestone") === "on",
    onCalendar: formData.get("onCalendar") === "on",
    visibleToAgent: formData.get("visibleToAgent") === "on",
    visibleToClient: formData.get("visibleToClient") === "on",
    emailTemplateId: optStr(formData, "emailTemplateId"),
    autoSendEmail: formData.get("autoSendEmail") === "on",
    attachmentTemplateId: optStr(formData, "attachmentTemplateId"),
    dateTemplateId: optStr(formData, "dateTemplateId"),
    docTemplateId: optStr(formData, "docTemplateId"),
    priority: oneOf(formData, "priority", PRIORITIES, TaskPriority.NORMAL),
    reminderDays: intOr(formData, "reminderDays", null),
  };
}

/** `oneOf` needs a non-null fallback, but "no role" is a real answer here. */
function roleOrNull(formData: FormData): AssigneeRole | null {
  const raw = optStr(formData, "assigneeRole");
  return raw && ROLES.includes(raw) ? (raw as AssigneeRole) : null;
}

/**
 * The dependency this entry may point at, or null.
 *
 * Two things are checked against the database rather than trusted from the
 * form: that the target is an entry of *this* plan, and that pointing at it
 * doesn't close a loop. A loop would leave both entries permanently undated
 * — each waiting on the other to finish first — which reads as a broken
 * dating engine rather than the bad template it actually is.
 */
async function safeDependsOn(
  tx: TenantTx,
  actionPlanId: string,
  entryId: string | null,
  candidate: string | null,
): Promise<string | null> {
  if (!candidate) return null;
  const siblings = await tx.actionPlanTask.findMany({
    where: { actionPlanId },
    select: { id: true, dependsOnId: true, sortOrder: true },
  });
  if (!siblings.some((s) => s.id === candidate)) return null;
  // A brand-new entry has nothing pointing at it yet, so it can't be part of
  // a loop; only an existing one needs the walk.
  if (entryId && wouldCycle(siblings, entryId, candidate)) return null;
  return candidate;
}

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
  redirect(`/dashboard/templates?tab=tasks&planId=${created.id}`);
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
        ...entryFields(formData),
        dependsOnId: await safeDependsOn(tx, actionPlanId, null, optStr(formData, "dependsOnId")),
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
  });
  revalidatePath("/dashboard/templates");
}

export async function updateTemplateTask(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const actionPlanId = str(formData, "actionPlanId");
  const title = str(formData, "title");
  if (!id || !actionPlanId || !title) return;
  await withTenant(tenantId, async (tx) =>
    tx.actionPlanTask.update({
      // Scoped to the plan the form claims: the id alone is enough for RLS,
      // but not enough to stop one plan's form editing another's entry.
      where: { id, actionPlanId },
      data: {
        title,
        ...entryFields(formData),
        dependsOnId: await safeDependsOn(tx, actionPlanId, id, optStr(formData, "dependsOnId")),
      },
    }),
  );
  revalidatePath("/dashboard/templates");
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
  revalidatePath("/dashboard/templates");
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
  revalidatePath("/dashboard/templates");
}

export async function deleteTemplateDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.actionPlanDocument.delete({ where: { id } }));
  revalidatePath("/dashboard/templates");
}
