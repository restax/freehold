import { prisma } from "@freehold/db";
import {
  type ClientConnectorCapability,
  clientConnectorCapability,
  sameConnectorEmail,
} from "@/lib/client-connector";

/**
 * Turn a proven OAuth identity into "whose files, and what may this do".
 *
 * The sibling of lib/mcp-session.ts, and the security seam for the clients'
 * connector in the same way that file is for the staff one. The token proves
 * *who* the person is and nothing else: the workspace and the client come
 * from the connection row, and the authority comes from the level the
 * coordinator has set right now.
 *
 * The difference that matters is the last line of defence. A member's context
 * scopes to a workspace and trusts their membership to bound what they see
 * inside it. There is no equivalent here — a client is not a member, and the
 * only thing standing between them and the rest of the workspace is that
 * every query downstream is keyed on `clientId`. That is why this returns it
 * rather than leaving callers to look it up: one place decides whose files
 * these are, so a tool cannot accidentally decide differently.
 *
 * Nothing is cached. Every tool call pays the lookups, which is the price of
 * a coordinator dropping a client to no-access taking effect on that client's
 * next message rather than whenever a refresh token happens to lapse.
 */
export interface ClientConnectorContext {
  tenantId: string;
  /** Whose files. Every downstream query is keyed on this, without exception. */
  clientId: string;
  clientName: string;
  userId: string;
  connectionId: string;
  capability: ClientConnectorCapability;
}

export async function resolveClientConnectorContext(
  userId: string | null | undefined,
  oauthClientId: string | null | undefined,
): Promise<ClientConnectorContext | null> {
  if (!userId || !oauthClientId) return null;

  // The pair, matching mcp_connection: a second Claude the same person
  // connected against a different client gets its own row and cannot read
  // across to this one.
  const connection = await prisma.clientConnectorConnection.findUnique({
    where: { userId_oauthClientId: { userId, oauthClientId } },
    select: { id: true, tenantId: true, clientId: true, boundEmail: true, revokedAt: true },
  });
  if (!connection || connection.revokedAt) return null;

  // Both re-read live rather than trusted from the connection's existence.
  // A client dropped to NONE, or a workspace that switched the feature off,
  // keeps a technically valid OAuth token until it expires; without this they
  // would keep reading the files too.
  const [client, org] = await Promise.all([
    prisma.client.findFirst({
      // Scoped by tenant as well as id. The foreign keys already guarantee
      // the client belongs to this tenant, but a resolver that reads a row by
      // id alone is one refactor away from not caring, and this is the row
      // that decides whose data is about to be handed out.
      where: { id: connection.clientId, tenantId: connection.tenantId },
      select: { id: true, name: true, email: true, connectorLevel: true },
    }),
    prisma.organization.findUnique({
      where: { id: connection.tenantId },
      select: { clientConnectorEnabled: true },
    }),
  ]);
  if (!client || !org) return null;

  // The address this connection was bound to must still be the address on the
  // client record. This is how a coordinator cuts off the wrong person: an
  // agent leaves the brokerage, the coordinator corrects the email to whoever
  // replaced them, and the old connection stops answering on the next call
  // rather than whenever its refresh token happens to lapse. Comparing
  // case-insensitively for the same reason the grant is matched that way —
  // nobody types their own address the same way twice.
  if (!sameConnectorEmail(connection.boundEmail, client.email)) return null;

  const capability = clientConnectorCapability(client.connectorLevel, org.clientConnectorEnabled);
  // No read is no access, and indistinguishable from no connection at all:
  // the caller is then told nothing about whether the workspace, the client,
  // or the grant was the thing that said no.
  if (!capability.read) return null;

  // Fire-and-forget: the coordinator's client page shows "last used", and
  // failing to record that must never fail the call the client actually made.
  prisma.clientConnectorConnection
    .update({ where: { id: connection.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    tenantId: connection.tenantId,
    clientId: client.id,
    clientName: client.name,
    userId,
    connectionId: connection.id,
    capability,
  };
}
