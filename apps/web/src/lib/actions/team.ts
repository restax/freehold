"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
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

/**
 * Assign a member's compliance review authority: "default" follows their role
 * (owner/admin review, member submits), "0" is submitter-only even for an
 * admin, "1".."3" reviews at that level. The owner always holds top authority
 * and can't be reassigned here. Audited — this decides who can pass a file.
 */
export async function updateMemberComplianceTier(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const memberId = str(formData, "memberId");
  const raw = str(formData, "complianceTier");
  if (!memberId) return;
  const complianceTier = raw === "default" ? null : Number.parseInt(raw, 10);
  if (
    complianceTier !== null &&
    (Number.isNaN(complianceTier) || complianceTier < 0 || complianceTier > 3)
  ) {
    return;
  }
  const target = await prisma.member.findFirst({
    where: { id: memberId, organizationId: tenantId },
    include: { user: { select: { email: true } } },
  });
  if (!target || target.role === "owner") return;
  await prisma.member.update({ where: { id: memberId }, data: { complianceTier } });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "compliance.reviewer_changed",
    summary:
      complianceTier === null
        ? `${target.user.email} follows their role for compliance review`
        : complianceTier === 0
          ? `${target.user.email} set to submitter-only for compliance`
          : `${target.user.email} set to level-${complianceTier} compliance reviewer`,
  });
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
