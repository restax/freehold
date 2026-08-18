"use server";

import { prisma } from "@freehold/db";
import { logAudit } from "@/lib/audit";
import { sameConnectorEmail } from "@/lib/client-connector";
import { portalConnectorOffer, recordClientConnectorGrant } from "@/lib/client-connector-grant";
import { liveLink } from "@/lib/portal";
import { getSession } from "@/lib/session";

/**
 * Record that the person now signed in is the agent this portal link is for.
 *
 * Called after they have proved the mailbox with an emailed code. Everything
 * is re-derived here rather than accepted from the browser, because the only
 * thing the caller supplies is a portal token:
 *
 * - the token must still be live, and must be an agent link naming a client;
 * - the client must still be offered a connection, which re-runs the
 *   workspace switch and the level the coordinator set;
 * - the signed-in account's address must match the client record's, and must
 *   be verified — signing in with an emailed code is what proves both.
 *
 * The last check is the one doing the real work. A portal token is a URL, and
 * URLs get forwarded; without it, anyone a client forwarded their portal link
 * to could sign up under their own address and claim the grant.
 */
export async function claimClientConnectorGrant(
  token: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sign in with the emailed code first." };

  const link = await liveLink(token);
  if (link?.audience !== "AGENT" || !link.clientId) {
    return { error: "This link is no longer active. Ask your coordinator for a new one." };
  }

  const offer = await portalConnectorOffer(link.tenantId, link.clientId);
  if (!offer) {
    return { error: "Your coordinator hasn't turned this on for you." };
  }

  if (!session.user.emailVerified) {
    return { error: "Confirm your email address first." };
  }
  if (!sameConnectorEmail(session.user.email, offer.email)) {
    return {
      error: "That account's email doesn't match the address your coordinator has for you.",
    };
  }

  await recordClientConnectorGrant({
    tenantId: link.tenantId,
    clientId: link.clientId,
    userId: session.user.id,
    boundEmail: offer.email,
  });

  // Mark the account as one that exists only to hold a connection — but only
  // when it really is one. An agent signing in here for the first time has no
  // workspace of their own, and without this flag every screen that assumes a
  // coordinator would have to infer it from "has no workspaces", which is
  // also true of a real coordinator on their first morning.
  //
  // A coordinator who is also somebody's client keeps their own account
  // untouched: they have a membership, so the flag stays off and none of
  // their own surfaces change under them.
  const memberships = await prisma.member.count({ where: { userId: session.user.id } });
  if (memberships === 0) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { isClientIdentity: true },
    });
  }

  logAudit({
    tenantId: link.tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "clientConnector.claimed",
    summary: `${session.user.email} confirmed their address to connect their own Claude`,
    subjectType: "clientConnectorGrant",
    subjectId: link.clientId,
  });

  return { ok: true };
}
