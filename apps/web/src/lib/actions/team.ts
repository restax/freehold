"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { oneOf, str } from "@/lib/forms";
import { seatState } from "@/lib/plans";
import { requireAdminTenant } from "@/lib/tenant";

const ROLES = ["owner", "admin", "member"] as const;

/**
 * Team management writes go straight to the Better Auth tables (member /
 * invitation) — Better Auth reads the same rows, so invitations created here
 * are acceptable through its standard acceptInvitation flow.
 */
export async function inviteMember(formData: FormData) {
  const { tenantId, userId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const email = str(formData, "email").toLowerCase();
  if (!email) return;
  const seats = await seatState(tenantId);
  if (seats.limited) return; // cloud seat cap; the team page shows the upgrade banner

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.invitation.create({
    data: {
      id: randomUUID(),
      organizationId: tenantId,
      email,
      role: oneOf(formData, "role", ROLES, "member"),
      status: "pending",
      expiresAt,
      inviterId: userId,
    },
  });
  revalidatePath("/dashboard/team");
}

export async function cancelInvitation(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  if (!id) return;
  await prisma.invitation.deleteMany({ where: { id, organizationId: tenantId } });
  revalidatePath("/dashboard/team");
}

export async function updateMemberRole(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const memberId = str(formData, "memberId");
  const role = oneOf(formData, "role", ROLES, "member");
  if (!memberId) return;
  const target = await prisma.member.findFirst({
    where: { id: memberId, organizationId: tenantId },
  });
  if (!target || target.role === "owner") return; // never demote the owner here
  await prisma.member.update({ where: { id: memberId }, data: { role } });
  revalidatePath("/dashboard/team");
}

export async function removeMember(formData: FormData) {
  const { tenantId, userId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const memberId = str(formData, "memberId");
  if (!memberId) return;
  const target = await prisma.member.findFirst({
    where: { id: memberId, organizationId: tenantId },
  });
  if (!target || target.role === "owner" || target.userId === userId) return;
  await prisma.member.delete({ where: { id: memberId } });
  revalidatePath("/dashboard/team");
}
