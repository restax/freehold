"use server";

import { prisma } from "@freehold/db";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { connectableClients } from "@/lib/client-connector-grant";
import { getSession } from "@/lib/session";

/**
 * Approve a Claude connection for an outside agent.
 *
 * The client-side twin of approveMcpConsent, and it keeps that function's
 * ordering for the same reason: record which client the connection speaks for
 * first, then let Better Auth mint the authorization code. The other way
 * round leaves a window where a valid token exists with no client behind it,
 * and every tool call in that window fails with nothing to explain why. The
 * reverse failure is harmless — a connection row with no token is inert, and
 * the unique pair means a retry updates it rather than piling up.
 */
export async function approveClientConnectorConsent(
  oauthClientId: string,
  clientId: string,
  consentCode: string | null,
): Promise<{ redirect?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Your session expired. Sign in and try again." };

  // Never trust the client id from the form. Re-deriving through
  // connectableClients re-runs every gate — the workspace switch, the level
  // the coordinator set, and whether the address this person proved is still
  // the address on the record — so a form posted with someone else's client
  // id resolves to nothing rather than to their files.
  const options = await connectableClients(session.user.id);
  const binding = options.find((option) => option.clientId === clientId);
  if (!binding) {
    return { error: "That connection is no longer available. Ask your coordinator." };
  }

  // The registered name, kept on the row so the coordinator's client page
  // stays readable after the dynamic registration behind it is pruned.
  const app = await prisma.oauthApplication.findUnique({
    where: { clientId: oauthClientId },
    select: { name: true },
  });
  const appName = app?.name ?? "Claude";

  await prisma.clientConnectorConnection.upsert({
    where: { userId_oauthClientId: { userId: session.user.id, oauthClientId } },
    create: {
      tenantId: binding.tenantId,
      userId: session.user.id,
      clientId: binding.clientId,
      oauthClientId,
      oauthClientName: appName,
      boundEmail: binding.boundEmail,
    },
    // Re-approving is how an agent who is a client of two coordinators points
    // the same Claude at the other one, and how a revoked connection returns.
    update: {
      tenantId: binding.tenantId,
      clientId: binding.clientId,
      oauthClientName: appName,
      boundEmail: binding.boundEmail,
      revokedAt: null,
    },
  });

  // Logged against the coordinator's workspace, not the agent's account: the
  // person who needs to see that an outsider connected is the subscriber.
  logAudit({
    tenantId: binding.tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "clientConnector.connected",
    summary: `${binding.clientName} connected ${appName} to their own files`,
    subjectType: "clientConnectorConnection",
    subjectId: binding.clientId,
  });

  const result = await auth.api.oAuthConsent({
    body: { accept: true, consent_code: consentCode ?? undefined },
    headers: await headers(),
  });

  const redirect = (result as { redirectURI?: string } | null)?.redirectURI;
  if (!redirect) return { error: "Could not complete the connection. Try again from Claude." };
  return { redirect };
}
