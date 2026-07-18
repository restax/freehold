"use server";

import { DateAnchor, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { intOr, oneOf, optStr, str } from "@/lib/forms";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

const ANCHORS = Object.values(DateAnchor);

export async function createPlan(formData: FormData) {
  const { tenantId } = await requireTenant();
  const name = str(formData, "name");
  if (!name) return;
  const created = await withTenant(tenantId, (tx) =>
    tx.actionPlan.create({
      data: { tenantId, name, description: optStr(formData, "description") },
    }),
  );
  revalidatePath("/dashboard/action-plans");
  redirect(`/dashboard/action-plans/${created.id}`);
}

export async function deletePlan(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const id = str(formData, "id");
  if (!id || !isAdmin) return;
  await withTenant(tenantId, (tx) => tx.actionPlan.delete({ where: { id } }));
  revalidatePath("/dashboard/action-plans");
  redirect("/dashboard/action-plans");
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
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
  });
  revalidatePath(`/dashboard/action-plans/${actionPlanId}`);
}

export async function deleteTemplateTask(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const actionPlanId = str(formData, "actionPlanId");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.actionPlanTask.delete({ where: { id } }));
  revalidatePath(`/dashboard/action-plans/${actionPlanId}`);
}
