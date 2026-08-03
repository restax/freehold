"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
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

/**
 * The other way onto the team: an admin provisions the account directly
 * rather than the invitee accepting a link. Only for a brand-new email —
 * an email already tied to a Freehold account is refused (use Invite
 * instead), so this can never silently attach someone else's existing
 * account to a workspace they never agreed to join.
 */
export async function addTeamMember(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const email = str(formData, "email").toLowerCase();
  if (!email) return;
  const name = str(formData, "name") || email.split("@")[0];
  const seats = await seatState(tenantId);
  if (seats.limited) return;

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return;

  // A random, discarded password — this person sets their own via the "Send
  // email" reset link rather than an invite-link accept flow.
  const password = `${randomUUID()}${randomUUID()}`;
  await auth.api.signUpEmail({ body: { email, password, name } });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  // Added by an admin, not self-registered — skip the OTP dance, same as
  // demo/vendor accounts created the same way.
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });

  await prisma.member.create({
    data: {
      id: randomUUID(),
      organizationId: tenantId,
      userId: user.id,
      role: oneOf(formData, "role", ROLES, "member"),
    },
  });
  revalidatePath("/dashboard/team");
}

/** Nudges a member (freshly added or not) to set their own password. Reuses
 *  the same reset-password email the "forgot password" link sends. */
export async function sendMemberWelcomeEmail(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const memberId = str(formData, "memberId");
  if (!memberId) return;
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: tenantId },
    include: { user: { select: { email: true } } },
  });
  if (!member) return;
  await auth.api.requestPasswordReset({ body: { email: member.user.email } });
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

/**
 * Grant or revoke billing authority. "default" follows the role (owner/admin
 * full, member none); view/manage/full grant increasing access — full
 * includes seeing what teammates are paid. Audited: this decides who reads
 * the books.
 */
export async function updateMemberBillingRole(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const memberId = str(formData, "memberId");
  const raw = str(formData, "billingRole");
  if (!memberId) return;
  if (!["default", "view", "manage", "full"].includes(raw)) return;
  const billingRole = raw === "default" ? null : raw;
  const target = await prisma.member.findFirst({
    where: { id: memberId, organizationId: tenantId },
    include: { user: { select: { email: true } } },
  });
  if (!target || target.role === "owner") return;
  await prisma.member.update({ where: { id: memberId }, data: { billingRole } });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "billing.access_changed",
    summary:
      billingRole === null
        ? `${target.user.email} follows their role for billing access`
        : `${target.user.email} granted billing access: ${billingRole}`,
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
