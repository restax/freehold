import { prisma } from "@freehold/db";
import { decryptSecret, type EncryptedSecret, loadMasterKey } from "@freehold/vault";
import { looseEquals, samePhone } from "@/lib/ai/lead-capture";
import { type TwentyPhoneFields, twentyPhone, twentyPhoneShapes } from "@/lib/twenty-phone";

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

/** Whether a Twenty error body is the phone validator refusing the number. */
function isPhoneRejection(status: number, body: string): boolean {
  return status === 400 && /INVALID_PHONE_NUMBER|phone number is invalid/i.test(body);
}

/**
 * Create a person in Twenty — used to push website leads across, and the
 * recommend-a-friend admin form. Returns the created person's id (needed to
 * attach a note) alongside the plain ok/fail the website-lead path already
 * relies on.
 *
 * The phone is walked through the shapes in twenty-phone.ts, best first, and
 * a rejection of the number alone falls through to the next spelling and
 * finally to saving without it. A contact is worth more than the formatting
 * of one field, and `phoneDropped` is the honest half of that: the number
 * doesn't disappear quietly, the caller is told to add it by hand.
 */
export async function sendTwentyLead(
  conn: TwentyConnection,
  lead: { name: string; email?: string | null; phone?: string | null },
): Promise<{ ok: boolean; id?: string; phoneDropped?: boolean }> {
  const [firstName, ...rest_] = lead.name.split(" ");
  // The trailing null is "no phone at all", always the last thing tried, so a
  // number nothing accepts still leaves a person in the CRM.
  const attempts: Array<TwentyPhoneFields | null> = [...twentyPhoneShapes(lead.phone), null];

  const post = (phones: TwentyPhoneFields | null) =>
    fetch(`${rest(conn.url)}/people`, {
      method: "POST",
      headers: headers(conn.apiKey),
      body: JSON.stringify({
        name: { firstName, lastName: rest_.join(" ") || undefined },
        ...(lead.email ? { emails: { primaryEmail: lead.email } } : {}),
        ...(phones ? { phones } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });

  try {
    for (const [i, phones] of attempts.entries()) {
      const res = await post(phones);
      if (res.ok) {
        const body = (await res.json()) as { data?: { createPerson?: { id?: string } } };
        return {
          ok: true,
          id: body.data?.createPerson?.id,
          // Dropped when this attempt carried no phone but a phone was given.
          phoneDropped: Boolean(lead.phone) && !phones,
        };
      }

      const text = await res.text().catch(() => "");
      console.error(
        `sendTwentyLead: non-ok response (attempt ${i + 1}/${attempts.length})`,
        res.status,
        text,
      );
      // Only a complaint about the number itself is worth another attempt.
      // Anything else — a bad key, a schema mismatch — repeats identically.
      if (!isPhoneRejection(res.status, text)) return { ok: false };
    }
    return { ok: false };
  } catch (err) {
    console.error("sendTwentyLead: threw", err);
    return { ok: false };
  }
}

/**
 * Twenty's REST `filter` grammar is `field[comparator]:value`, with dotted
 * paths for composite fields and or()/and()/not() conjunctions. Its parser
 * counts parentheses and splits on commas *inside conjunctions*, so a value
 * containing either — "(916) 555-0142", "Smith, Jones & Co" — corrupts the
 * parse. A single bare predicate skips that code path entirely and takes
 * everything after the first colon as the value, so every query built here
 * stays single-predicate on purpose. Combine results in memory instead of
 * reaching for or().
 *
 * Comparators available: eq, neq, in, containsAny, is, gt, gte, lt, lte,
 * startsWith, endsWith, like, ilike.
 */
async function queryTwenty<T>(
  conn: TwentyConnection,
  object: "people" | "companies",
  filter: string,
  limit = 20,
): Promise<{ ok: boolean; rows: T[] }> {
  try {
    const res = await fetch(
      `${rest(conn.url)}/${object}?filter=${encodeURIComponent(filter)}&limit=${limit}`,
      { headers: headers(conn.apiKey), signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      console.error(`queryTwenty(${object}): non-ok`, res.status, await res.text().catch(() => ""));
      return { ok: false, rows: [] };
    }
    const body = (await res.json()) as {
      data?: Record<string, T[]> | T[];
    };
    const rows = Array.isArray(body.data) ? body.data : (body.data?.[object] ?? []);
    return { ok: true, rows };
  } catch (err) {
    console.error(`queryTwenty(${object}): threw`, err);
    return { ok: false, rows: [] };
  }
}

/**
 * Existing people who look like the lead being saved.
 *
 * `ok` is false when any lookup failed, which the caller must surface
 * distinctly: reporting "no duplicates" because the request errored is the
 * one failure mode that actually creates the duplicate this is meant to
 * prevent.
 *
 * Email is matched case-insensitively; phone and first name are compared in
 * memory (see samePhone/looseEquals) because CRM rows store phone formatting
 * inconsistently and a server-side eq would miss "(916) 555-0142" against
 * "9165550142".
 */
export async function findTwentyDuplicates(
  conn: TwentyConnection,
  lead: {
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  },
): Promise<{ ok: boolean; matches: TwentyPerson[] }> {
  const found = new Map<string, TwentyPerson>();
  let ok = true;

  if (lead.email) {
    const r = await queryTwenty<TwentyPerson>(
      conn,
      "people",
      `emails.primaryEmail[ilike]:${lead.email}`,
    );
    ok &&= r.ok;
    for (const p of r.rows) if (p.id) found.set(p.id, p);
  }

  // Last name narrows server-side; first name and phone are then checked
  // against the candidates in memory, where formatting can be normalized.
  if (lead.lastName) {
    const r = await queryTwenty<TwentyPerson>(
      conn,
      "people",
      `name.lastName[ilike]:${lead.lastName}`,
      60,
    );
    ok &&= r.ok;
    for (const p of r.rows) {
      if (!p.id) continue;
      const nameMatches = lead.firstName ? looseEquals(p.name?.firstName, lead.firstName) : true;
      if (nameMatches) found.set(p.id, p);
    }
  }

  if (lead.phone) {
    // No general server-side phone filter: stored formatting varies too much
    // for eq to be trustworthy, so candidates already gathered are checked in
    // memory. The exact-string attempts cover the two spellings that do match:
    // the normalized digits we now write, and the raw string as typed, for
    // rows that were saved with their formatting intact.
    for (const p of found.values()) {
      if (samePhone(p.phones?.primaryPhoneNumber, lead.phone)) found.set(p.id, p);
    }
    const spellings = new Set([twentyPhone(lead.phone), lead.phone].filter(Boolean) as string[]);
    for (const spelling of spellings) {
      const r = await queryTwenty<TwentyPerson>(
        conn,
        "people",
        `phones.primaryPhoneNumber[eq]:${spelling}`,
      );
      ok &&= r.ok;
      for (const p of r.rows) if (p.id) found.set(p.id, p);
    }
  }

  return { ok, matches: [...found.values()] };
}

/** Deep link to a record in Twenty's own UI, for the duplicate warning. */
export function twentyPersonUrl(conn: TwentyConnection, personId: string): string {
  return `${conn.url.replace(/\/$/, "")}/object/person/${personId}`;
}

/**
 * Find a company by name, or create it. Twenty has no free-text company field
 * on Person — company is its own object joined by companyId — so a screenshot
 * that names a brokerage needs the company to exist first.
 *
 * Matching is case-insensitive (ilike) so "Bayside Realty" doesn't become a
 * second row alongside "bayside realty". Returns null rather than throwing
 * when Twenty is unreachable or the workspace has a non-standard Company
 * schema: the person still saves, and the caller reports the company as
 * unlinked.
 */
export async function findOrCreateTwentyCompany(
  conn: TwentyConnection,
  name: string,
): Promise<{ id: string; created: boolean } | null> {
  const existing = await queryTwenty<{ id: string }>(
    conn,
    "companies",
    `name.name[ilike]:${name}`,
    1,
  );
  if (existing.rows[0]?.id) return { id: existing.rows[0].id, created: false };

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
