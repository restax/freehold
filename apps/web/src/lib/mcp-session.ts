import { prisma } from "@freehold/db";
import { type McpCapability, mcpCapability } from "@/lib/mcp-access";

/**
 * Turn a proven OAuth identity into "which workspace, and what may it do".
 *
 * This is the security seam for the whole connector, so it re-derives
 * everything rather than trusting anything the caller sent. The token proves
 * *who* the person is and nothing else: the workspace comes from the
 * connection row they approved on the consent screen, and the authority comes
 * from their membership as it stands right now.
 *
 * Nothing here is cached. Every tool call pays two indexed lookups, which is
 * the price of a demotion or a kill switch taking effect on someone's next
 * message instead of whenever their refresh token happens to lapse.
 */
export interface McpContext {
  tenantId: string;
  userId: string;
  connectionId: string;
  capability: McpCapability;
}

export async function resolveMcpContext(
  userId: string | null | undefined,
  clientId: string | null | undefined,
): Promise<McpContext | null> {
  if (!userId || !clientId) return null;

  // The workspace is whatever this person approved for this client. Note the
  // pair: a second Claude client the same person connected to a *different*
  // workspace gets its own row and cannot read across.
  const connection = await prisma.mcpConnection.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: { id: true, tenantId: true, revokedAt: true },
  });
  if (!connection || connection.revokedAt) return null;

  // Membership is checked live, not assumed from the connection's existence.
  // Someone removed from the workspace keeps a technically valid OAuth token
  // until it expires; without this they would keep reading the files too.
  const [member, org] = await Promise.all([
    prisma.member.findFirst({
      where: { organizationId: connection.tenantId, userId },
      select: { role: true, mcpRole: true },
    }),
    prisma.organization.findUnique({
      where: { id: connection.tenantId },
      select: { mcpEnabled: true },
    }),
  ]);
  if (!member || !org) return null;

  const capability = mcpCapability(member.role, member.mcpRole, org.mcpEnabled);
  // No capability at all is indistinguishable from no connection, on purpose:
  // the caller then has nothing to leak about whether the workspace exists.
  if (!capability.read && !capability.write) return null;

  // Fire-and-forget: the Settings page shows "last used", and a failure to
  // record that must never fail the call the person actually made.
  prisma.mcpConnection
    .update({ where: { id: connection.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    tenantId: connection.tenantId,
    userId,
    connectionId: connection.id,
    capability,
  };
}
