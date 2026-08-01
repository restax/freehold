"use server";

import { prisma } from "@freehold/db";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { getSession, listTenants } from "@/lib/session";

/**
 * Approve a Claude connection.
 *
 * Two things happen here and the order matters. We record *which workspace*
 * the connection speaks for first, then hand the approval to Better Auth,
 * which mints the authorization code. If it were the other way round there
 * would be a window where a valid token existed with no workspace behind it,
 * and every tool call in that window would fail with nothing to explain why.
 *
 * The reverse failure is harmless: a connection row with no token is inert,
 * and the unique constraint on (userId, clientId) means a retry updates the
 * same row rather than accumulating junk.
 */
export async function approveMcpConsent(
  clientId: string,
  tenantId: string,
  consentCode: string | null,
): Promise<{ redirect?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Your session expired. Sign in and try again." };

  // Never trust the tenant id from the form: re-derive it from the workspaces
  // this person actually belongs to. Without this, anyone could point a
  // connection at a workspace they've merely heard the id of.
  const tenants = await listTenants();
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) return { error: "You are not a member of that workspace." };

  // The client's own registered name, for a Settings list that stays readable
  // after the DCR row behind it is pruned.
  const client = await prisma.oauthApplication.findUnique({
    where: { clientId },
    select: { name: true },
  });

  await prisma.mcpConnection.upsert({
    where: { userId_clientId: { userId: session.user.id, clientId } },
    create: {
      tenantId,
      userId: session.user.id,
      clientId,
      clientName: client?.name ?? "Claude",
    },
    // Re-approving is how someone moves a connection to a different
    // workspace, and how a previously revoked one comes back.
    update: { tenantId, clientName: client?.name ?? "Claude", revokedAt: null },
  });

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "mcp.connected",
    summary: `Connected ${client?.name ?? "Claude"} to this workspace`,
    subjectType: "mcpConnection",
    subjectId: clientId,
  });

  const result = await auth.api.oAuthConsent({
    body: { accept: true, consent_code: consentCode ?? undefined },
    headers: await headers(),
  });

  const redirect = (result as { redirectURI?: string } | null)?.redirectURI;
  if (!redirect) return { error: "Could not complete the connection. Try again from Claude." };
  return { redirect };
}

/** Decline the connection; Better Auth returns the client to its error URI. */
export async function denyMcpConsent(
  consentCode: string | null,
): Promise<{ redirect?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Your session expired." };
  const result = await auth.api.oAuthConsent({
    body: { accept: false, consent_code: consentCode ?? undefined },
    headers: await headers(),
  });
  const redirect = (result as { redirectURI?: string } | null)?.redirectURI;
  return redirect ? { redirect } : { error: "Declined." };
}
