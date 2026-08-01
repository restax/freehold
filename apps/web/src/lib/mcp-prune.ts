import { prisma } from "@freehold/db";

/**
 * Sweep up spent OAuth clients and tokens.
 *
 * Dynamic Client Registration means Claude registers a *new* client on every
 * fresh connection rather than once per product — Anthropic's own docs warn
 * about the resulting growth. Nothing breaks if we ignore it, but the table
 * grows without bound and every row is a credential-shaped object we no
 * longer have a use for.
 *
 * Two passes, in order. Expired tokens go first so that clients whose only
 * remaining reference was an expired token become collectable in the same
 * run rather than the next one.
 */
export async function pruneMcpClients(): Promise<{ tokens: number; clients: number }> {
  const now = new Date();

  // A token whose *refresh* token has expired is dead: there is no way back
  // from it. Access-token expiry alone means nothing — that is the normal
  // state between refreshes.
  const tokens = await prisma.oauthAccessToken.deleteMany({
    where: { refreshTokenExpiresAt: { lt: now } },
  });

  // Clients with no token left at all. The grace period matters: a client
  // registers *before* its user finishes signing in and approving, so a
  // freshly registered client legitimately has no token for the length of a
  // consent flow. Deleting those would break the connection being set up.
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const stale = await prisma.oauthApplication.findMany({
    where: { createdAt: { lt: cutoff }, accessTokens: { none: {} } },
    select: { id: true },
  });
  const clients = await prisma.oauthApplication.deleteMany({
    where: { id: { in: stale.map((c) => c.id) } },
  });

  return { tokens: tokens.count, clients: clients.count };
}
