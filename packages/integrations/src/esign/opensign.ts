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

/**
 * The signing page's own login link — same origin as the API (FREEHOLD_OPENSIGN_URL,
 * not the mounted API path), decoded client-side by GuestLogin.jsx as
 * `atob(base64).split("/")`. Live-verified 2026-08-02.
 */
function signInUrl(docId: string, email: string): string {
  const base = envBase();
  const token = Buffer.from(`${docId}/${email}`).toString("base64");
  return `${base?.url ?? ""}/login/${token}`;
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
  companyName = "Freehold workspace",
): Promise<{ orgId: string; sessionToken: string }> {
  // A bare `_User` is NOT a usable OpenSign account. OpenSign's own signup
  // also creates a `partners_Tenant` and a `contracts_Users` extended-user row,
  // and the rest of the product assumes both exist — without them a document
  // sends and polls fine but the signer's page dies on `gettenant` /
  // `getDocument` 403s (live-verified 2026-08-02, this is what it replaced).
  //
  // Those three writes are done here rather than by calling OpenSign's
  // `usersignup` cloud function because that function is broken in the
  // published image: it throws `ReferenceError: normalizeEmail is not defined`
  // before doing anything. Re-implementing over the core REST API keeps this
  // working on stock images and keeps the arm's-length AGPL boundary — we
  // still only talk HTTP, never import their code.
  // The tenant's OpenSign email is derived from its id, so it's the same every
  // time. If the stored config is ever lost the account still exists, and a
  // plain signup would 400 forever — leaving that workspace permanently unable
  // to send. Recover the way OpenSign's own signup does: mint a session for the
  // existing user with the master key (`/loginAs`) instead of creating a second
  // account. The original password was random and discarded, so this is the
  // only way back in.
  const existingRes = await parseRequest(
    `/users?where=${encodeURIComponent(JSON.stringify({ username: email }))}&limit=1`,
    { method: "GET", masterKey: true },
  );
  const existing = (await existingRes.json()) as { results?: Array<{ objectId: string }> };
  const priorId = existing.results?.[0]?.objectId;

  const user = priorId
    ? await (async () => {
        const res = await parseRequest(`/loginAs?userId=${encodeURIComponent(priorId)}`, {
          method: "POST",
          masterKey: true,
        });
        return (await res.json()) as { objectId: string; sessionToken: string };
      })()
    : await (async () => {
        const res = await parseRequest("/users", {
          method: "POST",
          masterKey: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: email, email, password, name: companyName }),
        });
        return (await res.json()) as { objectId: string; sessionToken: string };
      })();

  const userPtr = { __type: "Pointer", className: "_User", objectId: user.objectId };

  // Reconnecting to an account that already has its tenant/extended-user rows
  // must not duplicate them.
  if (priorId) {
    const where = encodeURIComponent(JSON.stringify({ UserId: userPtr }));
    const extRes = await parseRequest(`/classes/contracts_Users?where=${where}&limit=1`, {
      method: "GET",
      masterKey: true,
    });
    const ext = (await extRes.json()) as { results?: unknown[] };
    if (ext.results?.length) return { orgId: user.objectId, sessionToken: user.sessionToken };
  }

  const tenantRes = await parseRequest("/classes/partners_Tenant", {
    method: "POST",
    masterKey: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      UserId: userPtr,
      CreatedBy: userPtr,
      TenantName: companyName,
      EmailAddress: email,
      IsActive: true,
    }),
  });
  const tenant = (await tenantRes.json()) as { objectId: string };

  await parseRequest("/classes/contracts_Users", {
    method: "POST",
    masterKey: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      UserId: userPtr,
      // The class this lands in is `contracts_Users`; the role string has to
      // agree with it (OpenSign derives one from the other by splitting on `_`).
      UserRole: "contracts_Admin",
      Email: email,
      Name: companyName,
      Company: companyName,
      TenantId: { __type: "Pointer", className: "partners_Tenant", objectId: tenant.objectId },
    }),
  });

  return { orgId: user.objectId, sessionToken: user.sessionToken };
}

/**
 * A signer, as OpenSign actually wants it: a `contracts_Contactbook` row
 * pointing at a real `_User`. Sending inline `{Name, Email}` objects instead
 * looks like it works — the document is created and status polls fine — but
 * OpenSign's own `DocumentAftersave.updateAclDoc` does
 * `Signers.map(s => s.UserId)` and then reads `.objectId` off each, so an
 * inline signer throws there and the document never gets a signer ACL. The
 * signing page then 403s. Hence: provision first, reference by pointer.
 */
interface SignerContact {
  contactId: string;
  userId: string;
}

/** Look up a Parse `_User` by email, creating one if this is a new signer. */
async function ensureParseUser(email: string, name: string): Promise<string> {
  const where = encodeURIComponent(JSON.stringify({ email }));
  const found = await parseRequest(`/users?where=${where}&limit=1`, {
    method: "GET",
    masterKey: true,
  });
  const existing = (await found.json()) as { results?: Array<{ objectId: string }> };
  if (existing.results?.[0]) return existing.results[0].objectId;

  // OpenSign's own guest-signup path (linkContactToDoc.js) sets password to
  // the email. Mirrored rather than improved on: these accounts are reachable
  // only through the tokenised signing link, and diverging would mean a signer
  // who later lands in OpenSign's own UI can't get in the way OpenSign expects.
  const created = await parseRequest("/users", {
    method: "POST",
    masterKey: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, email, password: email, name }),
  });
  const json = (await created.json()) as { objectId: string };
  return json.objectId;
}

/**
 * Find or create this tenant's Contactbook entry for a signer. Scoped by
 * `CreatedBy` so two workspaces signing with the same person's email each get
 * their own contact row — the same isolation boundary the rest of this
 * adapter keeps.
 */
async function ensureSignerContact(
  orgId: string,
  signer: { name: string; email: string },
): Promise<SignerContact> {
  const email = signer.email.trim().toLowerCase();
  const userId = await ensureParseUser(email, signer.name);
  const createdBy = { __type: "Pointer", className: "_User", objectId: orgId };

  const where = encodeURIComponent(JSON.stringify({ Email: email, CreatedBy: createdBy }));
  const found = await parseRequest(`/classes/contracts_Contactbook?where=${where}&limit=1`, {
    method: "GET",
    masterKey: true,
  });
  const existing = (await found.json()) as { results?: Array<{ objectId: string }> };
  if (existing.results?.[0]) return { contactId: existing.results[0].objectId, userId };

  const created = await parseRequest("/classes/contracts_Contactbook", {
    method: "POST",
    masterKey: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Name: signer.name,
      Email: email,
      UserId: { __type: "Pointer", className: "_User", objectId: userId },
      CreatedBy: createdBy,
      UserRole: "contracts_Guest",
      IsDeleted: false,
      ACL: {
        [orgId]: { read: true, write: true },
        [userId]: { read: true, write: true },
      },
    }),
  });
  const json = (await created.json()) as { objectId: string };
  return { contactId: json.objectId, userId };
}

const WIDGET_W = 150;
const WIDGET_H = 60;

/**
 * Page 1's size in PDF points, so signature boxes land on the page. Falls back
 * to US Letter if the PDF can't be parsed — a wrong-but-plausible guess beats
 * refusing to send.
 */
async function firstPageSize(pdf: Buffer): Promise<{ width: number; height: number }> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(new Uint8Array(pdf), { ignoreEncryption: true });
    const page = doc.getPages()[0];
    if (page) return page.getSize();
  } catch {
    // Malformed or encrypted PDF — fall through to the Letter default.
  }
  return { width: 612, height: 792 };
}

/**
 * One signature widget per signer, stacked up from the bottom-left of page 1.
 * OpenSign's own UI is a drag-and-drop field placer; Freehold has no such
 * surface, and a document with no widget leaves the signer nothing to click,
 * so every signer gets exactly one signature box.
 *
 * Positioned relative to the real page height rather than at a fixed offset:
 * a hardcoded y is off-page on any document shorter than the assumed size,
 * which puts the signer back to having nothing to click. Coordinates are
 * unscaled PDF points measured from the top-left, matching what OpenSign's
 * placer stores (it divides by scale before saving — PdfRequestFiles.jsx's
 * dropObj).
 */
function signatureWidget(index: number, page: { width: number; height: number }) {
  const margin = Math.min(60, page.width / 8);
  // Stack upward from the bottom margin, clamped so many signers can't push a
  // box off the top of a short page.
  const fromBottom = margin + WIDGET_H + index * (WIDGET_H + 20);
  const yPosition = Math.max(margin, page.height - fromBottom);
  return {
    pageNumber: 1,
    pos: [
      {
        xPosition: margin,
        yPosition,
        isStamp: false,
        key: index,
        scale: 1,
        zIndex: index + 1,
        type: "signature",
        options: { name: `signature-${index + 1}`, status: "required" },
        Width: Math.min(WIDGET_W, page.width - margin * 2),
        Height: WIDGET_H,
      },
    ],
  };
}

/**
 * This tenant's `contracts_Users` row — OpenSign's "extended user", which
 * carries the tenant link. Every document must point at one via `ExtUserPtr`:
 * `getDocument` does `delete document.ExtUserPtr.TenantId.FileAdapters`
 * unguarded, so a document without it throws inside OpenSign's own handler,
 * gets swallowed by its catch, and returns `{}` — the signing page then dies
 * on `Cannot read properties of undefined`. Sending and polling are unaffected,
 * which is why this only shows up when someone tries to sign.
 *
 * Created here if absent so workspaces provisioned before that was understood
 * heal themselves on their next send instead of needing a manual repair.
 */
async function ensureExtUser(orgId: string, companyName: string): Promise<string> {
  const userPtr = { __type: "Pointer", className: "_User", objectId: orgId };
  const where = encodeURIComponent(JSON.stringify({ UserId: userPtr }));
  const found = await parseRequest(`/classes/contracts_Users?where=${where}&limit=1`, {
    method: "GET",
    masterKey: true,
  });
  const existing = (await found.json()) as { results?: Array<{ objectId: string }> };
  if (existing.results?.[0]) return existing.results[0].objectId;

  const tenantRes = await parseRequest("/classes/partners_Tenant", {
    method: "POST",
    masterKey: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      UserId: userPtr,
      CreatedBy: userPtr,
      TenantName: companyName,
      IsActive: true,
    }),
  });
  const tenant = (await tenantRes.json()) as { objectId: string };

  const extRes = await parseRequest("/classes/contracts_Users", {
    method: "POST",
    masterKey: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      UserId: userPtr,
      UserRole: "contracts_Admin",
      Name: companyName,
      Company: companyName,
      TenantId: { __type: "Pointer", className: "partners_Tenant", objectId: tenant.objectId },
    }),
  });
  const ext = (await extRes.json()) as { objectId: string };
  return ext.objectId;
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

      // Signers must exist as Contactbook rows before the document references
      // them; see ensureSignerContact for why inline signers aren't enough.
      const extUserId = await ensureExtUser(override.orgId, "Freehold workspace");
      const page = await firstPageSize(pdf);

      const contacts: Array<SignerContact & { email: string }> = [];
      for (const signer of signers) {
        const contact = await ensureSignerContact(override.orgId, signer);
        contacts.push({ ...contact, email: signer.email.trim().toLowerCase() });
      }

      const res = await parseRequest("/functions/createdocumentfromapp", {
        method: "POST",
        sessionToken: override.sessionToken,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: {
            Name: title,
            URL: url,
            Signers: contacts.map((c) => ({
              __type: "Pointer",
              className: "contracts_Contactbook",
              objectId: c.contactId,
            })),
            // Required even though createdocumentfromapp.js doesn't validate its
            // presence: every downstream guest-signing path (linkContactToDoc's
            // saveRoleContact) dereferences CreatedBy.objectId and throws if it's
            // missing — a failure that only surfaces once a signer actually opens
            // the doc, never at send time. Live-verified 2026-08-02: omitting this
            // sent successfully but crashed guest sign-in with a 403 downstream.
            CreatedBy: { __type: "Pointer", className: "_User", objectId: override.orgId },
            // See ensureExtUser: without this the signing page cannot load the
            // document at all, though sending and polling look perfectly fine.
            ExtUserPtr: {
              __type: "Pointer",
              className: "contracts_Users",
              objectId: extUserId,
            },
            // What the guest-signing page actually reads. `signerObjId`/`signerPtr`
            // being pre-set is what lets linkContactToDoc.js short-circuit on its
            // first branch instead of trying to invent a contact at sign time;
            // `placeHolder` carries the widget the signer clicks.
            Placeholders: contacts.map((c, i) => ({
              Id: `${i + 1}`,
              email: c.email,
              Role: `signer${i + 1}`,
              order: i + 1,
              signerObjId: c.contactId,
              signerPtr: {
                __type: "Pointer",
                className: "contracts_Contactbook",
                objectId: c.contactId,
              },
              placeHolder: [signatureWidget(i, page)],
            })),
            SentToOthers: true,
            SendinOrder: false,
          },
        }),
      });
      const json = (await res.json()) as { result: { objectId: string } };
      const externalId = json.result.objectId;
      return {
        externalId,
        // OpenSign has no outbound mail configured (it's arm's-length
        // infrastructure Freehold operates, not a hosted account with its
        // own notification pipeline — see createOpenSignUser's comment), so
        // there's no other way a signer finds out this exists. This is the
        // exact link the guest-signing flow expects: base64("<docId>/<email>"),
        // matching OpenSignServer's createBatchDocs.js signPdf construction.
        signerLinks: contacts.map((c) => ({
          email: c.email,
          url: signInUrl(externalId, c.email),
        })),
      };
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

export const _openSignInternals = { mapStatus, signInUrl };
