"use server";

import { type TemplateGroupKind, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { str } from "@/lib/forms";
import { requireTenant } from "@/lib/tenant";

/**
 * Groups within one Templates-hub tab. Generic across the five kinds — the
 * hub always shows "All Templates" and "No Group" ahead of the named ones,
 * which don't need a database row.
 */

export async function createTemplateGroup(formData: FormData) {
  const { tenantId } = await requireTenant();
  const kind = str(formData, "kind") as TemplateGroupKind;
  const name = str(formData, "name");
  if (!name) return;
  await withTenant(tenantId, async (tx) => {
    const max = await tx.templateGroup.aggregate({ where: { kind }, _max: { sortOrder: true } });
    await tx.templateGroup.create({
      data: { tenantId, kind, name, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
  });
  revalidatePath("/dashboard/templates");
}

export async function renameTemplateGroup(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return;
  await withTenant(tenantId, (tx) => tx.templateGroup.update({ where: { id }, data: { name } }));
  revalidatePath("/dashboard/templates");
}

/** Deletes the group; its templates fall back to "No Group" (onDelete: SetNull). */
export async function deleteTemplateGroup(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.templateGroup.delete({ where: { id } }));
  revalidatePath("/dashboard/templates");
}
