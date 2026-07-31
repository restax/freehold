"use server";

import { prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { confirmed, optStr, str } from "@/lib/forms";
import { getMemberRole, requireAdminTenant, requireTenant } from "@/lib/tenant";

/**
 * Signature-block editing rights: owners and admins always have them;
 * everyone else only when the workspace opted in via
 * Organization.membersCanEditSignatures. Checked fresh on every write
 * rather than trusted from the form — a member whose access was revoked
 * mid-session shouldn't be able to keep editing off a stale page.
 */
async function canEditSignatures(tenantId: string, userId: string): Promise<boolean> {
  const role = await getMemberRole(tenantId, userId);
  if (role === "owner" || role === "admin") return true;
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { membersCanEditSignatures: true },
  });
  return org?.membersCanEditSignatures === true;
}

function signatureFields(formData: FormData) {
  return {
    name: str(formData, "name").trim(),
    displayName: str(formData, "displayName").trim(),
    title: optStr(formData, "title"),
    company: optStr(formData, "company"),
    email: optStr(formData, "email"),
    phone: optStr(formData, "phone"),
  };
}

export async function createSignature(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  if (!(await canEditSignatures(tenantId, userId))) return;
  const f = signatureFields(formData);
  if (!f.name || !f.displayName) return;
  await withTenant(tenantId, async (tx) => {
    // The workspace's first signature block is the default by construction —
    // otherwise every automated email would have nothing to fall back to
    // until someone remembers to flip one on.
    const existing = await tx.emailSignature.count();
    await tx.emailSignature.create({ data: { tenantId, ...f, isDefault: existing === 0 } });
  });
  revalidatePath("/dashboard/emails");
}

export async function updateSignature(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  if (!(await canEditSignatures(tenantId, userId))) return;
  const id = str(formData, "id");
  const f = signatureFields(formData);
  if (!id || !f.name || !f.displayName) return;
  await withTenant(tenantId, (tx) => tx.emailSignature.update({ where: { id }, data: f }));
  revalidatePath("/dashboard/emails");
}

export async function deleteSignature(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  if (!(await canEditSignatures(tenantId, userId))) return;
  const id = str(formData, "id");
  if (!id || !confirmed(formData)) return;
  await withTenant(tenantId, async (tx) => {
    const target = await tx.emailSignature.findUnique({
      where: { id },
      select: { isDefault: true },
    });
    await tx.emailSignature.delete({ where: { id } });
    // Deleting the default leaves automated mail with nothing to send as —
    // promote whatever's left so there's always exactly one, or none at all.
    if (target?.isDefault) {
      const next = await tx.emailSignature.findFirst({ orderBy: { createdAt: "asc" } });
      if (next)
        await tx.emailSignature.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  revalidatePath("/dashboard/emails");
}

export async function setDefaultSignature(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  if (!(await canEditSignatures(tenantId, userId))) return;
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, async (tx) => {
    await tx.emailSignature.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    await tx.emailSignature.update({ where: { id }, data: { isDefault: true } });
  });
  revalidatePath("/dashboard/emails");
}

/** Owner/admin only: whether regular members may edit the signature library. */
export async function saveSignaturePermission(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  await prisma.organization.update({
    where: { id: tenantId },
    data: { membersCanEditSignatures: formData.get("membersCanEdit") === "on" },
  });
  revalidatePath("/dashboard/emails");
}
