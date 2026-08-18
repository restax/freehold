import { prisma, withTenant } from "@freehold/db";
import { clientConnectorOffered, sameConnectorEmail } from "@/lib/client-connector";
import { mcpResourceUrl } from "@/lib/mcp";

/**
 * The bridge between "this person proved a mailbox" and "this person may
 * connect their Claude to that client's files".
 *
 * Grants are written from the agent portal, where the tenant and the client
 * are already known from the link's token, and read on the OAuth consent
 * screen, where neither is. See the migration for why the read cannot be a
 * search: `client` carries forced row-level security, so a grant row naming
 * its own tenant is what makes the lookup possible at all.
 *
 * A grant is a claim, never an entitlement. Everything that could have
 * changed since it was written is re-derived on the way out — the workspace
 * switch, the client's level, and whether the address it was proved against
 * is still the address on the client record. That last one is what makes
 * correcting a client's email the way to cut off an agent who has left.
 */
export interface ConnectableClient {
  tenantId: string;
  tenantName: string;
  clientId: string;
  clientName: string;
  boundEmail: string;
}

/**
 * Record that this person holds the address on this client record.
 *
 * The caller must already have proved both halves: the tenant and client come
 * from a live portal link, and the identity from an authenticated session
 * whose email was verified. This function does not re-check either, because
 * it cannot — it is the portal's job to know which client its own token names.
 */
export async function recordClientConnectorGrant(args: {
  tenantId: string;
  clientId: string;
  userId: string;
  boundEmail: string;
}): Promise<void> {
  await prisma.clientConnectorGrant.upsert({
    where: { userId_clientId: { userId: args.userId, clientId: args.clientId } },
    create: args,
    // Re-proving is how a grant follows a corrected address, and the unique
    // pair means a retry updates one row rather than accumulating attempts.
    update: { boundEmail: args.boundEmail, tenantId: args.tenantId },
  });
}

/**
 * Every client this person may currently connect to, newest claim first.
 *
 * Read per tenant rather than through a join: the grant table has no RLS but
 * `client` does, so the client row is only visible inside its own tenant's
 * context. One round trip per grant is fine — a person has one or two.
 */
export async function connectableClients(
  userId: string | null | undefined,
): Promise<ConnectableClient[]> {
  if (!userId) return [];

  const grants = await prisma.clientConnectorGrant.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { tenantId: true, clientId: true, boundEmail: true },
  });
  if (grants.length === 0) return [];

  const resolved = await Promise.all(
    grants.map(async (grant) => {
      const [client, org] = await Promise.all([
        withTenant(grant.tenantId, (tx) =>
          tx.client.findUnique({
            where: { id: grant.clientId },
            select: { id: true, name: true, email: true, connectorLevel: true },
          }),
        ),
        // organization has no RLS: it is the row that establishes a tenant.
        prisma.organization.findUnique({
          where: { id: grant.tenantId },
          select: { name: true, clientConnectorEnabled: true },
        }),
      ]);
      if (!client || !org) return null;
      if (!clientConnectorOffered(client.connectorLevel, org.clientConnectorEnabled)) return null;
      // The claim was proved against an address. If the coordinator has since
      // changed it, this grant belongs to whoever held the old one.
      if (!sameConnectorEmail(grant.boundEmail, client.email)) return null;

      return {
        tenantId: grant.tenantId,
        tenantName: org.name,
        clientId: client.id,
        clientName: client.name,
        boundEmail: grant.boundEmail,
      };
    }),
  );

  return resolved.filter((row): row is ConnectableClient => row !== null);
}

/**
 * What the agent portal should offer, for the client that portal link names.
 *
 * Returns null when there is nothing to offer — the workspace switch is off,
 * the coordinator left this client at no access, or the client record has no
 * email to prove. The last one matters: without an address there is no way
 * for the agent to demonstrate they are the person the record means, so the
 * honest thing is to show nothing rather than a button that cannot work.
 */
export async function portalConnectorOffer(
  tenantId: string,
  clientId: string,
): Promise<{ email: string; connectorUrl: string } | null> {
  const [client, org] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.client.findUnique({
        where: { id: clientId },
        select: { email: true, connectorLevel: true },
      }),
    ),
    prisma.organization.findUnique({
      where: { id: tenantId },
      select: { clientConnectorEnabled: true },
    }),
  ]);
  if (!client?.email?.trim() || !org) return null;
  if (!clientConnectorOffered(client.connectorLevel, org.clientConnectorEnabled)) return null;
  // The staff connector's URL, and deliberately the same one: /api/mcp serves
  // both audiences and decides which from the connection rows behind the
  // token. See app/api/mcp/route.ts for why a second URL would cost a second
  // protected-resource document for no gain.
  return { email: client.email.trim(), connectorUrl: mcpResourceUrl() };
}
