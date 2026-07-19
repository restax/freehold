import { prisma } from "@freehold/db";
import { decryptSecret, type EncryptedSecret, loadMasterKey } from "@freehold/vault";

/**
 * Follow Up Boss connection, per tenant. Plain API-key Basic auth (key as
 * username, blank password) — no OAuth, no approval process. The key is
 * encrypted on the organization row with VAULT_MASTER_KEY.
 *
 * Per FUB's docs: new leads go through POST /v1/events (so the account's
 * automations fire); /v1/people is for reading and updating existing people.
 */

export const FUB_BASE = "https://api.followupboss.com/v1";

interface StoredFubConfig {
  enc: EncryptedSecret;
  importedAt?: string;
  importedCount?: number;
}

export function fubHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    "X-System": "Freehold",
    "Content-Type": "application/json",
  };
}

export function parseFubConfig(raw: unknown): StoredFubConfig | null {
  const c = raw as StoredFubConfig | null;
  return c?.enc ? c : null;
}

export async function loadFubKey(tenantId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { fubConfig: true },
  });
  const stored = parseFubConfig(org?.fubConfig);
  if (!stored) return null;
  try {
    return decryptSecret(stored.enc, loadMasterKey());
  } catch {
    return null;
  }
}

export async function fubStatus(
  tenantId: string,
): Promise<{ connected: boolean; importedAt?: string; importedCount?: number }> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { fubConfig: true },
  });
  const stored = parseFubConfig(org?.fubConfig);
  return stored
    ? { connected: true, importedAt: stored.importedAt, importedCount: stored.importedCount }
    : { connected: false };
}

export async function verifyFubKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${FUB_BASE}/people?limit=1`, {
      headers: fubHeaders(apiKey),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface FubPerson {
  id: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  emails?: Array<{ value: string }>;
  phones?: Array<{ value: string }>;
  stage?: string;
  source?: string;
}

/** Pull people, paginated. Caps at `max` to stay inside FUB rate limits. */
export async function fetchFubPeople(apiKey: string, max = 1000): Promise<FubPerson[]> {
  const people: FubPerson[] = [];
  let offset = 0;
  const limit = 100;
  while (people.length < max) {
    const res = await fetch(`${FUB_BASE}/people?limit=${limit}&offset=${offset}`, {
      headers: fubHeaders(apiKey),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) break;
    const data = (await res.json()) as { people?: FubPerson[] };
    const batch = data.people ?? [];
    people.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return people.slice(0, max);
}

/**
 * Send a lead into FUB through the events API so the tenant's automations
 * (action plans, assignment rules) fire exactly as for any other source.
 */
export async function sendFubLead(
  apiKey: string,
  lead: { name: string; email?: string | null; phone?: string | null; message?: string | null },
): Promise<boolean> {
  const [firstName, ...rest] = lead.name.split(" ");
  try {
    const res = await fetch(`${FUB_BASE}/events`, {
      method: "POST",
      headers: fubHeaders(apiKey),
      body: JSON.stringify({
        source: "Freehold",
        system: "Freehold",
        type: "General Inquiry",
        message: lead.message ?? undefined,
        person: {
          firstName,
          lastName: rest.join(" ") || undefined,
          emails: lead.email ? [{ value: lead.email }] : undefined,
          phones: lead.phone ? [{ value: lead.phone }] : undefined,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
