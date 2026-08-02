"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { str } from "@/lib/forms";
import { mcpRoleLabel } from "@/lib/mcp-access";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

/**
 * The three controls behind the connector: the workspace switch, the
 * per-member grant, and revoking one connection.
 *
 * All three are audited. Someone widening or narrowing what an AI assistant
 * can reach in a workspace full of client data is exactly the kind of change
 * a compliance view exists to show.
 */

/**
 * The subscriber's master switch.
 *
 * Turning it off also revokes every live connection in the workspace. The
 * capability resolver already refuses while the switch is off, so this is
 * belt-and-braces — but leaving connections marked live while the feature is
 * off makes the Settings list lie, and someone re-enabling the switch months
 * later would silently restore access they had forgotten granting.
 */
export async function setWorkspaceMcpEnabled(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const enabled = str(formData, "enabled") === "1";

  await prisma.organization.update({ where: { id: tenantId }, data: { mcpEnabled: enabled } });

  let revoked = 0;
  if (!enabled) {
    const live = await prisma.mcpConnection.findMany({
      where: { tenantId, revokedAt: null },
      select: { userId: true, clientId: true },
    });
    const result = await prisma.mcpConnection.updateMany({
      where: { tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    revoked = result.count;
    // Same per-connection scoping as revokeMcpConnection: a coordinator who
    // also works in another workspace keeps that connection.
    for (const c of live) {
      await prisma.oauthAccessToken.deleteMany({
        where: { userId: c.userId, clientId: c.clientId },
      });
    }
  }

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: enabled ? "mcp.workspace_enabled" : "mcp.workspace_disabled",
    summary: enabled
      ? "Turned the Claude connector on for this workspace"
      : [
          "Turned the Claude connector off for this workspace",
          revoked ? `disconnected ${revoked}` : null,
        ]
          .filter(Boolean)
          .join(", "),
  });

  revalidatePath("/dashboard/integrations");
}

/** Per-member grant, mirroring how billing access is assigned on the Team page. */
export async function updateMemberMcpRole(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const memberId = str(formData, "memberId");
  const raw = str(formData, "mcpRole");
  if (!memberId) return;
  if (!["default", "none", "read", "write"].includes(raw)) return;
  const mcpRole = raw === "default" ? null : raw;

  const target = await prisma.member.findFirst({
    where: { id: memberId, organizationId: tenantId },
    include: { user: { select: { email: true } } },
  });
  // The owner is excluded here for the same reason the resolver ignores their
  // grant: this page is where grants live, so locking themselves out would
  // leave no way back.
  if (!target || target.role === "owner") return;

  await prisma.member.update({ where: { id: memberId }, data: { mcpRole } });

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "mcp.access_changed",
    summary: `Claude access for ${target.user.email}: ${mcpRoleLabel(target.role, mcpRole, true)}`,
    subjectType: "member",
    subjectId: memberId,
  });

  revalidatePath("/dashboard/team");
}

/**
 * Disconnect one connection.
 *
 * Anyone may revoke their own; only an admin may revoke someone else's. The
 * row is kept with a timestamp rather than deleted, so "Claude had access
 * between these dates" stays answerable after the fact.
 */
export async function revokeMcpConnection(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  const connectionId = str(formData, "connectionId");
  if (!connectionId) return;

  const connection = await prisma.mcpConnection.findFirst({
    where: { id: connectionId, tenantId },
    select: { id: true, userId: true, clientId: true, clientName: true },
  });
  if (!connection) return;

  if (connection.userId !== userId) {
    const { isAdmin } = await requireAdminTenant();
    if (!isAdmin) return;
  }

  await prisma.mcpConnection.update({
    where: { id: connection.id },
    data: { revokedAt: new Date() },
  });

  // Drop the tokens too. The resolver would refuse anyway, but a revoked
  // connection should not leave a working bearer token sitting in a third
  // party's storage.
  //
  // Scoped to this user *and* this client, not just the user: someone who
  // coordinates for two workspaces has a separate connection for each, and
  // disconnecting one must not silently sign them out of the other.
  await prisma.oauthAccessToken.deleteMany({
    where: { userId: connection.userId, clientId: connection.clientId },
  });

  logAudit({
    tenantId,
    actorId: userId,
    action: "mcp.disconnected",
    summary: `Disconnected ${connection.clientName}`,
    subjectType: "mcpConnection",
    subjectId: connection.id,
  });

  revalidatePath("/dashboard/integrations");
}
