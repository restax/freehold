import { prisma } from "@freehold/db";
import { decryptSecret, type EncryptedSecret, loadMasterKey } from "@freehold/vault";

/**
 * Twenty CRM connection, per tenant. Twenty is the open-source CRM — cloud
 * (https://api.twenty.com) or self-hosted — with plain Bearer API-key auth
 * (Settings → API & Webhooks in Twenty). No OAuth, no approval process.
 * The key is encrypted on the organization row with VAULT_MASTER_KEY.
 */

interface StoredTwentyConfig {
  url: string;
  enc: EncryptedSecret;
  importedAt?: string;
  importedCount?: number;
}

export interface TwentyConnection {
  url: string;
  apiKey: string;
}

export function parseTwentyConfig(raw: unknown): StoredTwentyConfig | null {
  const c = raw as StoredTwentyConfig | null;
  return c?.url && c.enc ? c : null;
}

export async function loadTwentyConnection(tenantId: string): Promise<TwentyConnection | null> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { twentyConfig: true },
  });
  const stored = parseTwentyConfig(org?.twentyConfig);
  if (!stored) return null;
  try {
    return { url: stored.url, apiKey: decryptSecret(stored.enc, loadMasterKey()) };
  } catch (err) {
    console.error("loadTwentyConnection: decrypt failed", err);
    return null;
  }
}

export async function twentyStatus(
  tenantId: string,
): Promise<{ connected: boolean; url?: string; importedAt?: string; importedCount?: number }> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { twentyConfig: true },
  });
  const stored = parseTwentyConfig(org?.twentyConfig);
  return stored
    ? {
        connected: true,
        url: stored.url,
        importedAt: stored.importedAt,
        importedCount: stored.importedCount,
      }
    : { connected: false };
}

function headers(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

const rest = (url: string) => `${url.replace(/\/$/, "")}/rest`;

export async function verifyTwenty(conn: TwentyConnection): Promise<boolean> {
  try {
    const res = await fetch(`${rest(conn.url)}/people?limit=1`, {
      headers: headers(conn.apiKey),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface TwentyPerson {
  id: string;
  name?: { firstName?: string; lastName?: string };
  emails?: { primaryEmail?: string };
  phones?: { primaryPhoneNumber?: string };
}

/**
 * Pull people, cursor-paginated (Twenty caps pages at 60). Defensive about
 * response shape — workspaces have their own schemas, so only the standard
 * person fields are read.
 */
export async function fetchTwentyPeople(
  conn: TwentyConnection,
  max = 1000,
): Promise<TwentyPerson[]> {
  const people: TwentyPerson[] = [];
  let cursor: string | null = null;
  while (people.length < max) {
    const qs = `limit=60${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetch(`${rest(conn.url)}/people?${qs}`, {
      headers: headers(conn.apiKey),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) break;
    const body = (await res.json()) as {
      data?: { people?: TwentyPerson[] } | TwentyPerson[];
      pageInfo?: { hasNextPage?: boolean; endCursor?: string };
    };
    const batch = Array.isArray(body.data) ? body.data : (body.data?.people ?? []);
    people.push(...batch);
    if (!body.pageInfo?.hasNextPage || !body.pageInfo.endCursor || batch.length === 0) break;
    cursor = body.pageInfo.endCursor;
  }
  return people.slice(0, max);
}

/**
 * Create a person in Twenty — used to push website leads across, and the
 * recommend-a-friend admin form. Returns the created person's id (needed to
 * attach a note) alongside the plain ok/fail the website-lead path already
 * relies on.
 */
export async function sendTwentyLead(
  conn: TwentyConnection,
  lead: { name: string; email?: string | null; phone?: string | null },
): Promise<{ ok: boolean; id?: string }> {
  const [firstName, ...rest_] = lead.name.split(" ");
  try {
    const res = await fetch(`${rest(conn.url)}/people`, {
      method: "POST",
      headers: headers(conn.apiKey),
      body: JSON.stringify({
        name: { firstName, lastName: rest_.join(" ") || undefined },
        ...(lead.email ? { emails: { primaryEmail: lead.email } } : {}),
        ...(lead.phone ? { phones: { primaryPhoneNumber: lead.phone } } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(
        "sendTwentyLead: non-ok response",
        res.status,
        await res.text().catch(() => ""),
      );
      return { ok: false };
    }
    const body = (await res.json()) as { data?: { createPerson?: { id?: string } } };
    return { ok: true, id: body.data?.createPerson?.id };
  } catch (err) {
    console.error("sendTwentyLead: threw", err);
    return { ok: false };
  }
}

/**
 * Find a company by exact name, or create it. Twenty has no free-text
 * company field on Person — company is its own object joined by companyId —
 * so a screenshot that names a brokerage needs the company to exist first.
 *
 * The lookup is a filter on name.name (Twenty's composite name field).
 * Returns null rather than throwing when Twenty is unreachable or the
 * workspace has a non-standard Company schema: the person still saves, and
 * the caller reports the company as unlinked.
 */
export async function findOrCreateTwentyCompany(
  conn: TwentyConnection,
  name: string,
): Promise<{ id: string; created: boolean } | null> {
  try {
    const res = await fetch(
      `${rest(conn.url)}/companies?filter=${encodeURIComponent(`name.name[eq]:${name}`)}&limit=1`,
      { headers: headers(conn.apiKey), signal: AbortSignal.timeout(10_000) },
    );
    if (res.ok) {
      const body = (await res.json()) as {
        data?: { companies?: { id: string }[] } | { id: string }[];
      };
      const found = Array.isArray(body.data) ? body.data : (body.data?.companies ?? []);
      if (found[0]?.id) return { id: found[0].id, created: false };
    }
  } catch (err) {
    console.error("findOrCreateTwentyCompany: lookup threw", err);
  }

  try {
    const res = await fetch(`${rest(conn.url)}/companies`, {
      method: "POST",
      headers: headers(conn.apiKey),
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(
        "findOrCreateTwentyCompany: create non-ok",
        res.status,
        await res.text().catch(() => ""),
      );
      return null;
    }
    const body = (await res.json()) as { data?: { createCompany?: { id?: string } } };
    const id = body.data?.createCompany?.id;
    return id ? { id, created: true } : null;
  } catch (err) {
    console.error("findOrCreateTwentyCompany: create threw", err);
    return null;
  }
}

/** Link an existing person to a company (Twenty's Person.companyId). */
export async function linkTwentyPersonToCompany(
  conn: TwentyConnection,
  personId: string,
  companyId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${rest(conn.url)}/people/${personId}`, {
      method: "PATCH",
      headers: headers(conn.apiKey),
      body: JSON.stringify({ companyId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(
        "linkTwentyPersonToCompany: non-ok",
        res.status,
        await res.text().catch(() => ""),
      );
    }
    return res.ok;
  } catch (err) {
    console.error("linkTwentyPersonToCompany: threw", err);
    return false;
  }
}

/**
 * Attach a note to an existing person — Twenty's standard object model has
 * no free-text field on Person itself, so a note is its own object plus a
 * NoteTarget join row linking it to the person.
 */
export async function sendTwentyNote(
  conn: TwentyConnection,
  personId: string,
  body: string,
): Promise<boolean> {
  try {
    const noteRes = await fetch(`${rest(conn.url)}/notes`, {
      method: "POST",
      headers: headers(conn.apiKey),
      body: JSON.stringify({ title: "From freeholdtc.dev/recommend", body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!noteRes.ok) return false;
    const note = (await noteRes.json()) as { data?: { createNote?: { id?: string } } };
    const noteId = note.data?.createNote?.id;
    if (!noteId) return false;
    const targetRes = await fetch(`${rest(conn.url)}/noteTargets`, {
      method: "POST",
      headers: headers(conn.apiKey),
      body: JSON.stringify({ noteId, personId }),
      signal: AbortSignal.timeout(10_000),
    });
    return targetRes.ok;
  } catch {
    return false;
  }
}
