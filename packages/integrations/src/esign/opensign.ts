import type { EnvelopeStatusResult, EsignAdapter } from "./types.js";

/**
 * OpenSign adapter — the one provider Freehold operates itself rather than
 * each tenant bringing their own account (see Documenso/DocuSign). One
 * shared OpenSign instance (Parse Server + MongoDB), with every Freehold
 * workspace isolated as its own OpenSign user/session inside it.
 *
 * Live-verified 2026-08-02 against a local docker-compose.opensign.yml
 * instance (Documenso's adapter comment sets that bar; this one now clears
 * it for send/create): user provisioning (`POST /users` with the master
 * key), file upload (`POST /files/:name`), and `createdocumentfromapp`
 * all confirmed working exactly as coded, including the `Signers:
 * [{Name, Email}]` shape, which was the one piece built from convention
 * rather than source before testing.
 *
 * getStatus is grounded but not fully live-verified: the `getDocument`
 * cloud function either isn't registered under that name or wants
 * parameters this session didn't find, so it reads `contracts_Document`
 * straight off Parse's own class REST API instead (confirmed working).
 * What's still inferred rather than confirmed: SignedUrl as the signal for
 * "fully signed" — a real field per createDocumentFromApp's accepted
 * inputs, but this session never drove a document through an actual
 * signature (needs OpenSign's web client, not just the server API) to see
 * what changes on completion. See the comment on mapStatus() below.
 *
 * Auth model, deliberately asymmetric:
 *   - Provisioning a tenant (creating its OpenSign user) needs the Parse
 *     MASTER_KEY — platform-wide, env-only, never touches tenant code.
 *     That lives in apps/web/src/lib/opensign-config.ts (Prisma + vault),
 *     not here — this file is a pure HTTP client with no DB access.
 *   - Sending a document for signature uses that tenant's own OpenSign
 *     session token, passed in as `OpenSignConfig.sessionToken`. Least
 *     privilege: a compromised send-path credential can act only as one
 *     workspace's OpenSign user, never as the platform admin.
 */

export interface OpenSignConfig {
  /** This tenant's OpenSign user id (Parse objectId) — Freehold's org key inside OpenSign. */
  orgId: string;
  /** This tenant's OpenSign session token. Never the master key. */
  sessionToken: string;
}

function envBase(): { url: string; appId: string } | null {
  const url = process.env.FREEHOLD_OPENSIGN_URL?.replace(/\/$/, "");
  const appId = process.env.FREEHOLD_OPENSIGN_APP_ID;
  return url && appId ? { url, appId } : null;
}

/** Parse's REST mount point — PARSE_MOUNT in OpenSign's own env, default "/app". */
function mount(): string {
  return (process.env.FREEHOLD_OPENSIGN_MOUNT ?? "/app").replace(/\/$/, "");
}

async function parseRequest(
  path: string,
  init: RequestInit & { sessionToken?: string; masterKey?: boolean } = {},
): Promise<Response> {
  const base = envBase();
  if (!base) throw new Error("OpenSign is not configured for this platform.");
  const headers: Record<string, string> = {
    "X-Parse-Application-Id": base.appId,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.masterKey) {
    const masterKey = process.env.FREEHOLD_OPENSIGN_MASTER_KEY;
    if (!masterKey) throw new Error("FREEHOLD_OPENSIGN_MASTER_KEY is not set.");
    headers["X-Parse-Master-Key"] = masterKey;
  } else if (init.sessionToken) {
    headers["X-Parse-Session-Token"] = init.sessionToken;
  }
  const res = await fetch(`${base.url}${mount()}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new Error(`OpenSign ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

/**
 * Provision a new tenant's OpenSign user (platform admin operation, master
 * key). Called once per tenant by opensign-config.ts's provisioning flow —
 * not on every send. Uses Parse Server's own core `/users` signup endpoint,
 * not a custom cloud function, so this half is on firmer ground than the
 * document-creation calls below.
 */
export async function createOpenSignUser(
  email: string,
  password: string,
): Promise<{ orgId: string; sessionToken: string }> {
  const res = await parseRequest("/users", {
    method: "POST",
    masterKey: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, email, password }),
  });
  const json = (await res.json()) as { objectId: string; sessionToken: string };
  return { orgId: json.objectId, sessionToken: json.sessionToken };
}

/** Upload PDF bytes and get back a URL — Parse Server's core Files endpoint. */
async function uploadFile(sessionToken: string, filename: string, pdf: Buffer): Promise<string> {
  const res = await parseRequest(`/files/${encodeURIComponent(filename)}`, {
    method: "POST",
    sessionToken,
    headers: { "Content-Type": "application/pdf" },
    body: new Uint8Array(pdf),
  });
  const json = (await res.json()) as { url: string };
  return json.url;
}

/**
 * Live-verified 2026-08-02 against a local docker-compose.opensign.yml
 * instance: createEnvelope's upload → createdocumentfromapp path returns
 * exactly this shape (`{result: {objectId, Name, URL, Signers, ...}}`), and
 * `Signers: [{Name, Email}]` round-trips verbatim — the one part of this
 * adapter that was pure inference before testing turned out to be exactly
 * right.
 *
 * getStatus is NOT fully live-verified, though: the `getDocument` cloud
 * function either doesn't exist under that name or wants parameters this
 * session didn't find (tried docId/documentId/objectId/id, all either 400
 * or a silent empty result), so this reads the document straight off
 * Parse's own class REST API instead (`GET /classes/contracts_Document/id`),
 * which IS confirmed working. SignedUrl as the completion signal is now
 * grounded in OpenSign's own server source (apps/OpenSignServer/cloud/
 * parsefunction/DocumentBeforesave.js): it explicitly checks for SignedUrl
 * transitioning from unset to set as *the* completion trigger (marks
 * DocSentAt, updates counts). Confirmed by source, not yet by driving a
 * document through an actual signature — that still needs OpenSign's web
 * client. Also confirmed by source: OpenSign has no outbound webhook
 * mechanism at all (grepped the whole cloud/ tree — only NotifyOnSignatures
 * emails), so polling is not a Stage-1 shortcut, it's the only option. See
 * apps/web/src/lib/signature-sync.ts's writeBackSignedCopy, driven from
 * refreshEnvelope's poll in apps/web/src/lib/actions/esign.ts.
 */
function mapStatus(
  doc: { SignedUrl?: string; IsDeclined?: boolean } | undefined,
): EnvelopeStatusResult {
  if (doc?.SignedUrl) return { status: "COMPLETED", signedFileUrl: doc.SignedUrl };
  if (doc?.IsDeclined) return { status: "DECLINED" };
  return { status: "SENT" };
}

export function makeOpenSignAdapter(override?: OpenSignConfig): EsignAdapter {
  return {
    id: "OPENSIGN",
    label: "OpenSign",

    available: () =>
      envBase()
        ? { ok: true }
        : {
            ok: false,
            reason: "Set FREEHOLD_OPENSIGN_URL and FREEHOLD_OPENSIGN_APP_ID in .env",
          },

    async createEnvelope({ title, pdf, signers }) {
      if (!override) {
        throw new Error(
          "OpenSign has no session for this workspace yet — it should have been provisioned before this call.",
        );
      }
      const filename = title.toLowerCase().endsWith(".pdf") ? title : `${title}.pdf`;
      const url = await uploadFile(override.sessionToken, filename, pdf);

      const res = await parseRequest("/functions/createdocumentfromapp", {
        method: "POST",
        sessionToken: override.sessionToken,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: {
            Name: title,
            URL: url,
            Signers: signers.map((s) => ({ Name: s.name, Email: s.email })),
            SentToOthers: true,
            SendinOrder: false,
          },
        }),
      });
      const json = (await res.json()) as { result: { objectId: string } };
      return { externalId: json.result.objectId };
    },

    async getStatus(externalId) {
      if (!override) throw new Error("OpenSign has no session for this workspace.");
      const res = await parseRequest(`/classes/contracts_Document/${externalId}`, {
        method: "GET",
        sessionToken: override.sessionToken,
      });
      const doc = (await res.json()) as { SignedUrl?: string; IsDeclined?: boolean };
      return mapStatus(doc);
    },
  };
}

export const openSignAdapter: EsignAdapter = makeOpenSignAdapter();

export const _openSignInternals = { mapStatus };
