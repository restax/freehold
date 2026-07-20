"use server";

import { randomUUID } from "node:crypto";
import { EngagementStatus, prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { canEnd, canRespond } from "@/lib/engagements";
import { optStr, str } from "@/lib/forms";
import { GUEST_ROLE, requireAdminTenant } from "@/lib/tenant";

/**
 * Engagements: one workspace covering files for another, found through the
 * directory. Accepting creates a `guest` Member in the hiring workspace for
 * one named person on the vendor side — a real, revocable membership that
 * sees only the transactions they're assigned to.
 *
 * Nothing is copied or synced between workspaces. The file stays in the
 * workspace that owns it; the guest reaches into it, and ending the
 * engagement removes that reach entirely.
 *
 * Both sides are admin-gated: hiring outside help, and lending out one of your
 * people, are both owner-level decisions. Everything is audited on both sides.
 */

/** Hiring side: ask a listed workspace to cover files. */
export async function requestEngagement(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const vendorTenantId = str(formData, "vendorTenantId");
  if (!vendorTenantId || vendorTenantId === tenantId) return;

  // Only a workspace that actually listed itself can be engaged.
  const vendor = await prisma.organization.findUnique({
    where: { id: vendorTenantId },
    select: { name: true, directoryConfig: true },
  });
  if (!vendor || (vendor.directoryConfig as { listed?: boolean } | null)?.listed !== true) return;

  const existing = await withTenant(tenantId, (tx) =>
    tx.engagement.findFirst({
      where: {
        tenantId,
        vendorTenantId,
        status: { in: [EngagementStatus.REQUESTED, EngagementStatus.ACTIVE] },
      },
      select: { id: true },
    }),
  );
  if (existing) return; // already asked, or already working together

  await withTenant(tenantId, (tx) =>
    tx.engagement.create({
      data: {
        tenantId,
        vendorTenantId,
        note: optStr(formData, "note"),
        requestedById: session.user.id,
      },
    }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "engagement.requested",
    summary: `Asked ${vendor.name} to cover files`,
  });
  revalidatePath("/dashboard/engagements");
  revalidatePath("/dashboard/directory");
}

/**
 * Vendor side: accept, naming which of your people will do the work. That
 * person joins the hiring workspace as a guest.
 */
export async function acceptEngagement(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  const guestUserId = str(formData, "guestUserId");
  if (!id || !guestUserId) return;

  const engagement = await withTenant(tenantId, (tx) =>
    tx.engagement.findUnique({
      where: { id },
      select: { tenantId: true, vendorTenantId: true, status: true },
    }),
  );
  if (!engagement || !canRespond(engagement, tenantId)) return;

  // The named person must be one of ours.
  const membership = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId: guestUserId },
    select: { user: { select: { name: true, email: true } } },
  });
  if (!membership) return;

  const hirer = await prisma.organization.findUnique({
    where: { id: engagement.tenantId },
    select: { name: true },
  });

  // The guest membership in the hiring workspace — the whole mechanism.
  // Guests are excluded from seat counts and see only assigned files.
  const already = await prisma.member.findFirst({
    where: { organizationId: engagement.tenantId, userId: guestUserId },
    select: { id: true },
  });
  if (!already) {
    await prisma.member.create({
      data: {
        id: randomUUID(),
        organizationId: engagement.tenantId,
        userId: guestUserId,
        role: GUEST_ROLE,
      },
    });
  }

  await withTenant(tenantId, (tx) =>
    tx.engagement.update({
      where: { id },
      data: { status: EngagementStatus.ACTIVE, guestUserId, respondedAt: new Date() },
    }),
  );

  const summary = `${membership.user.name} is covering files for ${hirer?.name ?? "another workspace"}`;
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "engagement.accepted",
    summary,
  });
  // The hiring workspace needs this in their own trail — somebody outside
  // their company just gained access to files.
  logAudit({
    tenantId: engagement.tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "engagement.guest_added",
    summary: `${membership.user.email} joined as a guest to cover files`,
  });
  revalidatePath("/dashboard/engagements");
  revalidatePath("/dashboard/team");
}

/** Vendor side: turn a request down. */
export async function declineEngagement(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  if (!id) return;

  const updated = await withTenant(tenantId, async (tx) => {
    const e = await tx.engagement.findUnique({
      where: { id },
      select: { tenantId: true, vendorTenantId: true, status: true },
    });
    if (!e || !canRespond(e, tenantId)) return null;
    return tx.engagement.update({
      where: { id },
      data: { status: EngagementStatus.DECLINED, respondedAt: new Date() },
    });
  });
  if (!updated) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "engagement.declined",
    summary: "Declined a coverage request",
  });
  revalidatePath("/dashboard/engagements");
}

/**
 * Either side ends it. The guest membership and every assignment they held in
 * the hiring workspace are removed, so access stops immediately. Their fees
 * and pay requests survive — work already done still gets paid.
 */
export async function endEngagement(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  if (!id) return;

  const ended = await withTenant(tenantId, async (tx) => {
    const e = await tx.engagement.findUnique({
      where: { id },
      select: { tenantId: true, vendorTenantId: true, status: true, guestUserId: true },
    });
    if (!e || !canEnd(e, tenantId)) return null;
    await tx.engagement.update({
      where: { id },
      data: { status: EngagementStatus.ENDED, endedAt: new Date() },
    });
    return e;
  });
  if (!ended) return;

  if (ended.guestUserId) {
    // Revoke access in the hiring workspace: drop their assignments, then the
    // membership itself. Both are in the hirer's tenant, not necessarily ours.
    await withTenant(ended.tenantId, (tx) =>
      tx.transactionAssignee.deleteMany({
        where: { tenantId: ended.tenantId, userId: ended.guestUserId as string },
      }),
    );
    await prisma.member.deleteMany({
      where: {
        organizationId: ended.tenantId,
        userId: ended.guestUserId,
        role: GUEST_ROLE, // never remove a real member who also works there
      },
    });
  }

  for (const side of [ended.tenantId, ended.vendorTenantId]) {
    logAudit({
      tenantId: side,
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "engagement.ended",
      summary: "Coverage engagement ended; guest access revoked",
    });
  }
  revalidatePath("/dashboard/engagements");
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/transactions");
}
