import { prisma } from "@freehold/db";
import { createOpenSignUser, type OpenSignConfig } from "@freehold/integrations";
import { decryptSecret, type EncryptedSecret, encryptSecret, loadMasterKey } from "@freehold/vault";

/**
 * Per-tenant OpenSign provisioning. Unlike Documenso (esign-config.ts), a
 * tenant never enters anything — the whole point of "included, no signup"
 * is that the first send just works. So this creates the OpenSign user the
 * first time a tenant needs one, rather than only reading what an admin
 * already typed in.
 *
 * The session token is encrypted with @freehold/vault the same way
 * Documenso's per-tenant token is; the platform's own OpenSign master key
 * never touches this file or gets stored per-tenant — see
 * packages/integrations/src/esign/opensign.ts for why that split matters.
 */

interface StoredOpenSignConfig {
  orgId: string;
  enc: EncryptedSecret;
}

async function loadOpenSignConnection(tenantId: string): Promise<OpenSignConfig | undefined> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { openSignConfig: true },
  });
  const stored = org?.openSignConfig as StoredOpenSignConfig | null;
  if (!stored?.orgId || !stored.enc) return undefined;
  try {
    return { orgId: stored.orgId, sessionToken: decryptSecret(stored.enc, loadMasterKey()) };
  } catch {
    return undefined;
  }
}

/**
 * Load this tenant's OpenSign connection, provisioning one on first use.
 * Only called when the resolved e-sign provider is actually OPENSIGN — see
 * esign-config.ts's esignOverrides() — so a tenant using Documenso never
 * triggers an OpenSign account it will never touch.
 */
export async function provisionOpenSignOrg(tenantId: string): Promise<OpenSignConfig | undefined> {
  const existing = await loadOpenSignConnection(tenantId);
  if (existing) return existing;

  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  if (!org) return undefined;

  // A stable, unique, non-guessable email keeps this out of everyone else's
  // OpenSign namespace without needing a real inbox behind it — nothing is
  // ever sent there, it only identifies the Parse user.
  const email = `tenant-${tenantId}@opensign.freeholdtc.dev`;
  const password = `${tenantId}.${Date.now()}.${Math.random().toString(36).slice(2)}`;

  try {
    const { orgId, sessionToken } = await createOpenSignUser(email, password);
    await prisma.organization.update({
      where: { id: tenantId },
      data: { openSignConfig: { orgId, enc: { ...encryptSecret(sessionToken, loadMasterKey()) } } },
    });
    return { orgId, sessionToken };
  } catch {
    // Provisioning failure surfaces the same way any other adapter failure
    // does: available()/createEnvelope() throws, sendForSignature() records
    // it on the envelope row rather than losing it. Nothing to do here but
    // decline — a retry on the next send attempt is the recovery path.
    return undefined;
  }
}

/** Whether OpenSign is set up for this tenant yet. */
export async function openSignStatus(tenantId: string): Promise<{ connected: boolean }> {
  return { connected: (await loadOpenSignConnection(tenantId)) !== undefined };
}
