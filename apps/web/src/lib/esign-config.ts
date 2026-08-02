import { type EsignProvider, prisma } from "@freehold/db";
import type { DocumensoConfig, EsignOverrides } from "@freehold/integrations";
import { decryptSecret, type EncryptedSecret, loadMasterKey } from "@freehold/vault";
import { provisionOpenSignOrg } from "@/lib/opensign-config";

/**
 * Per-tenant e-sign connections. Cloud tenants can't set env vars, so each
 * workspace stores its own Documenso {url, token} on the organization row —
 * token encrypted with VAULT_MASTER_KEY, same as vault credentials. Env
 * (DOCUMENSO_*) stays the server-wide default for self-hosted installs.
 */

interface StoredDocumensoConfig {
  url: string;
  enc: EncryptedSecret;
}

export async function loadDocumensoConnection(
  tenantId: string,
): Promise<DocumensoConfig | undefined> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { documensoConfig: true },
  });
  const stored = org?.documensoConfig as StoredDocumensoConfig | null;
  if (!stored?.url || !stored.enc) return undefined;
  try {
    return { url: stored.url, token: decryptSecret(stored.enc, loadMasterKey()) };
  } catch {
    return undefined;
  }
}

/**
 * `provider` gates the OpenSign branch: provisioning makes an external API
 * call (and on first use, a DB write), so it only runs when the resolved
 * provider is actually OPENSIGN — a Documenso send must never trigger it.
 */
export async function esignOverrides(
  tenantId: string,
  provider?: EsignProvider,
): Promise<EsignOverrides> {
  return {
    documenso: await loadDocumensoConnection(tenantId),
    opensign: provider === "OPENSIGN" ? await provisionOpenSignOrg(tenantId) : undefined,
  };
}

/** Whether Documenso works for this tenant, and via which config source. */
export async function documensoStatus(
  tenantId: string,
): Promise<{ source: "tenant" | "env" | null; url?: string }> {
  const tenant = await loadDocumensoConnection(tenantId);
  if (tenant) return { source: "tenant", url: tenant.url };
  if (process.env.DOCUMENSO_URL && process.env.DOCUMENSO_API_TOKEN) {
    return { source: "env", url: process.env.DOCUMENSO_URL };
  }
  return { source: null };
}
