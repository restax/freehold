"use server";

import { DateAnchor, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { confirmed, intOr, optStr, str } from "@/lib/forms";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

const ANCHORS = new Set(Object.values(DateAnchor));

/** Unlike `oneOf`, an unset or unrecognized anchor here means "no suggestion
 *  — entered manually", not a fallback value. */
function optAnchor(formData: FormData, key: string): DateAnchor | null {
  const v = str(formData, key);
  return (ANCHORS.has(v as DateAnchor) ? v : null) as DateAnchor | null;
}

/**
 * Named sets of key dates ("Contract dates") with a suggested calculator per
 * date. Applying one proposes computed values on a transaction — the TC
 * confirms or overrides every one; nothing here writes a date directly.
 */

export async function createDateTemplate(formData: FormData) {
  const { tenantId } = await requireTenant();
  const name = str(formData, "name");
  if (!name) return;
  const created = await withTenant(tenantId, (tx) =>
    tx.dateTemplate.create({
      data: {
        tenantId,
        name,
        description: optStr(formData, "description"),
        groupId: optStr(formData, "groupId"),
      },
    }),
  );
  revalidatePath("/dashboard/templates");
  redirect(`/dashboard/templates?tab=dates&open=${created.id}`);
}

export async function addDateTemplateItem(formData: FormData) {
  const { tenantId } = await requireTenant();
  const dateTemplateId = str(formData, "dateTemplateId");
  const dateKey = str(formData, "dateKey");
  const label = str(formData, "label");
  if (!dateTemplateId || !dateKey || !label) return;
  await withTenant(tenantId, async (tx) => {
    const max = await tx.dateTemplateItem.aggregate({
      where: { dateTemplateId },
      _max: { sortOrder: true },
    });
    await tx.dateTemplateItem.create({
      data: {
        tenantId,
        dateTemplateId,
        dateKey,
        label,
        anchor: optAnchor(formData, "anchor"),
        offsetDays: intOr(formData, "offsetDays", null),
        calculator: optStr(formData, "calculator"),
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
  });
  revalidatePath("/dashboard/templates");
}

export async function deleteDateTemplateItem(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.dateTemplateItem.delete({ where: { id } }));
  revalidatePath("/dashboard/templates");
}

export async function deleteDateTemplate(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const id = str(formData, "id");
  if (!id || !isAdmin || !confirmed(formData)) return;
  await withTenant(tenantId, (tx) => tx.dateTemplate.delete({ where: { id } }));
  revalidatePath("/dashboard/templates");
}
