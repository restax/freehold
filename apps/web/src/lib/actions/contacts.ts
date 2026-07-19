"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { confirmed, dateOnly, intOr, optStr, str } from "@/lib/forms";
import { requireTenant } from "@/lib/tenant";

export async function createContact(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  const name = str(formData, "name");
  if (!name) return;
  const rating = intOr(formData, "rating");
  await withTenant(tenantId, (tx) =>
    tx.contact.create({
      data: {
        tenantId,
        ownerId: userId,
        name,
        email: optStr(formData, "email"),
        phone: optStr(formData, "phone"),
        category: str(formData, "category") || "Other",
        rating: rating != null && rating >= 1 && rating <= 5 ? rating : null,
        touchDate: dateOnly(formData, "touchDate"),
      },
    }),
  );
  revalidatePath("/dashboard/contacts");
}

export async function deleteContact(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  if (!id || !confirmed(formData)) return;
  const gone = await withTenant(tenantId, (tx) =>
    tx.contact.delete({ where: { id }, select: { name: true } }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "contact.deleted",
    summary: `Deleted contact "${gone.name}"`,
    subjectType: "contact",
    subjectId: id,
  });
  revalidatePath("/dashboard/contacts");
}
