"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { clientConnectorLevelLabel, isClientConnectorLevel } from "@/lib/client-connector";
import { str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * The two controls behind the clients' connector: the workspace switch, and
 * the per-client level.
 *
 * Both audited, for the same reason the member connector's are — someone
 * widening what an outside party's assistant can reach is exactly the change
 * a compliance view exists to show, and here the party is outside the
 * business entirely.
 *
 * Deliberately a separate file from mcp-settings.ts: nothing here should ever
 * be one careless edit away from changing what the *team's* connector does.
 */

/**
 * The subscriber's master switch for the clients' connector.
 *
 * Separate from the member switch on purpose. That one promises "off
 * disconnects everyone immediately", and the everyone it means is the team;
 * a coordinator pausing their staff's assistants should not silently cut off
 * every agent they work for, nor the reverse.
 *
 * Turning it off revokes every live client connection. The resolver already
 * refuses while the switch is off, so this is belt-and-braces — but leaving
 * rows marked live would make the connections list lie, and re-enabling the
 * switch months later would silently restore access someone had forgotten
 * granting.
 */
export async function setWorkspaceClientConnectorEnabled(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const enabled = str(formData, "enabled") === "1";

  await prisma.organization.update({
    where: { id: tenantId },
    data: { clientConnectorEnabled: enabled },
  });

  let revoked = 0;
  if (!enabled) {
    const live = await prisma.clientConnectorConnection.findMany({
      where: { tenantId, revokedAt: null },
      select: { userId: true, oauthClientId: true },
    });
    const result = await prisma.clientConnectorConnection.updateMany({
      where: { tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    revoked = result.count;
    // Deleting the tokens, not just marking the row: a refresh token that
    // survives revocation stays usable in someone else's storage for a week.
    // Scoped per (person, connected app) so a client who also works with
    // another workspace keeps that connection.
    for (const c of live) {
      await prisma.oauthAccessToken.deleteMany({
        where: { userId: c.userId, clientId: c.oauthClientId },
      });
    }
  }

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: enabled ? "client_connector.workspace_enabled" : "client_connector.workspace_disabled",
    summary: enabled
      ? "Turned the client connector on for this workspace"
      : `Turned the client connector off for this workspace${
          revoked > 0 ? `, disconnecting ${revoked} client${revoked === 1 ? "" : "s"}` : ""
        }`,
  });
  revalidatePath("/dashboard/integrations");
}

/**
 * What one client's own Claude may do, set by the coordinator on that
 * client's page.
 *
 * Dropping a client to a narrower level revokes their live connections
 * outright rather than leaving them to resolve at the new level. Narrowing is
 * a decision about a specific outside party; making them reconnect under the
 * level you actually meant is the honest reading of it, and it means "No
 * access" behaves like the off switch a coordinator expects rather than a
 * setting that quietly leaves a token working.
 */
export async function setClientConnectorLevel(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const clientId = str(formData, "clientId");
  const level = str(formData, "level");
  if (!clientId || !isClientConnectorLevel(level)) return;

  // Scoped to the tenant in the where-clause: this runs on the bare client,
  // outside withTenant, so nothing else constrains which row it can reach.
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
    select: { id: true, name: true, connectorLevel: true },
  });
  if (!client || client.connectorLevel === level) return;

  const RANK = { NONE: 0, READ: 1, APPROVE: 2, FULL: 3 } as const;
  const narrowing = RANK[level] < RANK[client.connectorLevel];

  await prisma.client.update({ where: { id: client.id }, data: { connectorLevel: level } });

  let revoked = 0;
  if (narrowing) {
    const live = await prisma.clientConnectorConnection.findMany({
      where: { tenantId, clientId: client.id, revokedAt: null },
      select: { userId: true, oauthClientId: true },
    });
    const result = await prisma.clientConnectorConnection.updateMany({
      where: { tenantId, clientId: client.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    revoked = result.count;
    for (const c of live) {
      await prisma.oauthAccessToken.deleteMany({
        where: { userId: c.userId, clientId: c.oauthClientId },
      });
    }
  }

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "client_connector.level_changed",
    summary: `Claude access for ${client.name}: ${clientConnectorLevelLabel(level, true)}${
      revoked > 0 ? ` (disconnected ${revoked} live connection${revoked === 1 ? "" : "s"})` : ""
    }`,
    subjectType: "client",
    subjectId: client.id,
  });
  revalidatePath(`/dashboard/clients/${client.id}`);
  revalidatePath("/dashboard/integrations");
}

/**
 * Disconnect one client connection by hand, from the client's page.
 *
 * The row is kept and stamped, never deleted — "this agent's assistant had
 * access between these dates" is a question asked after the fact, and a
 * deleted row cannot answer it.
 */
export async function revokeClientConnectorConnection(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "connectionId");
  if (!id) return;

  const conn = await prisma.clientConnectorConnection.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      userId: true,
      oauthClientId: true,
      boundEmail: true,
      clientId: true,
      revokedAt: true,
      client: { select: { name: true } },
    },
  });
  if (!conn || conn.revokedAt) return;

  await prisma.clientConnectorConnection.update({
    where: { id: conn.id },
    data: { revokedAt: new Date() },
  });
  await prisma.oauthAccessToken.deleteMany({
    where: { userId: conn.userId, clientId: conn.oauthClientId },
  });

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "client_connector.disconnected",
    summary: `Disconnected ${conn.boundEmail} from ${conn.client.name}'s files`,
    subjectType: "clientConnectorConnection",
    subjectId: conn.id,
  });
  revalidatePath(`/dashboard/clients/${conn.clientId}`);
  revalidatePath("/dashboard/integrations");
}
