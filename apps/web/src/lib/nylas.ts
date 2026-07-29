import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sending as the coordinator's own address, via Nylas.
 *
 * The default path for everything this app sends is Resend, from the
 * workspace's shared identity on our own domain (see lib/email.ts). This is
 * the opt-in alternative: a TC connects their real mailbox — Gmail, Outlook,
 * whatever — and mail goes out *from them*, landing in the recipient's inbox
 * as a normal message from a person they already correspond with, and in the
 * TC's own Sent folder.
 *
 * Raw fetch rather than the Nylas SDK, matching lib/email.ts: the surface
 * used here is four endpoints, and the SDK would be a dependency carrying a
 * lot more than that.
 *
 * Config (all env-gated; without them the connect UI shows a setup note):
 * - NYLAS_CLIENT_ID      application id, used to build the auth URL
 * - NYLAS_API_KEY        server-side key; also the client_secret at exchange
 * - NYLAS_WEBHOOK_SECRET signing secret for inbound message notifications
 * - NYLAS_API_HOST       region host, defaults to the US one
 */

const DEFAULT_HOST = "https://api.us.nylas.com";

function host(): string {
  return (process.env.NYLAS_API_HOST || DEFAULT_HOST).replace(/\/$/, "");
}

export function nylasEnabled(): boolean {
  return Boolean(process.env.NYLAS_CLIENT_ID && process.env.NYLAS_API_KEY);
}

export interface NylasGrantInfo {
  grantId: string;
  email: string;
  provider: string;
  status: string;
}

/**
 * Where to send the user to authorise their mailbox.
 *
 * No `provider` parameter on purpose — omitting it gives Nylas's own picker,
 * so Gmail/Outlook/IMAP all work without us maintaining a provider list or
 * guessing from the address domain.
 */
export function buildNylasAuthUrl(opts: { redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: process.env.NYLAS_CLIENT_ID ?? "",
    redirect_uri: opts.redirectUri,
    response_type: "code",
    access_type: "offline",
    state: opts.state,
  });
  return `${host()}/v3/connect/auth?${params}`;
}

/**
 * Trade the one-time callback code for a grant.
 *
 * The code burns on use: a failed exchange can't be retried with the same
 * code, the user has to start the connect flow again. So the caller treats
 * any throw here as "send them back to the connect button", not "retry".
 */
export async function exchangeNylasCode(opts: {
  code: string;
  redirectUri: string;
}): Promise<string> {
  const res = await fetch(`${host()}/v3/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NYLAS_CLIENT_ID,
      client_secret: process.env.NYLAS_API_KEY,
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`Nylas token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { grant_id?: string };
  if (!json.grant_id) throw new Error("Nylas token exchange returned no grant_id.");
  return json.grant_id;
}

/** Which address and provider a grant actually connected, and whether it still works. */
export async function fetchNylasGrant(grantId: string): Promise<NylasGrantInfo> {
  const res = await fetch(`${host()}/v3/grants/${encodeURIComponent(grantId)}`, {
    headers: {
      Authorization: `Bearer ${process.env.NYLAS_API_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Nylas grant lookup failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    data?: { id?: string; email?: string; provider?: string; grant_status?: string };
  };
  const d = json.data ?? {};
  return {
    grantId: d.id ?? grantId,
    email: d.email ?? "",
    provider: d.provider ?? "",
    status: d.grant_status ?? "valid",
  };
}

/** Best-effort revoke at Nylas. The local row is deleted regardless. */
export async function revokeNylasGrant(grantId: string): Promise<void> {
  await fetch(`${host()}/v3/grants/${encodeURIComponent(grantId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${process.env.NYLAS_API_KEY}` },
  });
}

export interface NylasParty {
  name: string;
  email: string;
}

export interface NylasAttachmentMeta {
  id: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
}

export interface NylasMessage {
  id: string;
  threadId: string;
  from: NylasParty[];
  to: NylasParty[];
  subject: string;
  /** HTML. */
  body: string;
  attachments: NylasAttachmentMeta[];
}

/** Exported for testing — the shape the webhook route trusts least, since it comes straight off the wire. */
export function parseParties(v: unknown): NylasParty[] {
  if (!Array.isArray(v)) return [];
  return v.map((p) => {
    const r = (p ?? {}) as Record<string, unknown>;
    return { name: typeof r.name === "string" ? r.name : "", email: String(r.email ?? "") };
  });
}

/**
 * The full message, fetched fresh rather than trusted from a webhook body.
 *
 * message.created's own payload is a thin reference (id, grant_id, thread_id)
 * — and for a message over 1MB, Nylas sends message.created.truncated with
 * the body stripped out entirely. Re-fetching here means the truncation case
 * needs no special handling: it's just another GET.
 */
export async function fetchNylasMessage(grantId: string, messageId: string): Promise<NylasMessage> {
  const res = await fetch(
    `${host()}/v3/grants/${encodeURIComponent(grantId)}/messages/${encodeURIComponent(messageId)}`,
    {
      headers: { Authorization: `Bearer ${process.env.NYLAS_API_KEY}`, Accept: "application/json" },
    },
  );
  if (!res.ok) {
    throw new Error(`Nylas message lookup failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: Record<string, unknown> };
  const d = json.data ?? {};
  const attachments = Array.isArray(d.attachments) ? d.attachments : [];
  return {
    id: typeof d.id === "string" ? d.id : messageId,
    threadId: typeof d.thread_id === "string" ? d.thread_id : "",
    from: parseParties(d.from),
    to: parseParties(d.to),
    subject: typeof d.subject === "string" ? d.subject : "",
    body: typeof d.body === "string" ? d.body : "",
    attachments: attachments.map((a) => {
      const r = (a ?? {}) as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        filename: typeof r.filename === "string" ? r.filename : "attachment",
        sizeBytes: typeof r.size === "number" ? r.size : 0,
        contentType:
          typeof r.content_type === "string" ? r.content_type : "application/octet-stream",
      };
    }),
  };
}

/** Raw bytes of one attachment. Nylas wants the attachment id URL-encoded. */
export async function downloadNylasAttachment(
  grantId: string,
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const url =
    `${host()}/v3/grants/${encodeURIComponent(grantId)}` +
    `/attachments/${encodeURIComponent(attachmentId)}/download` +
    `?message_id=${encodeURIComponent(messageId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.NYLAS_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Nylas attachment download failed: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export interface NylasSendInput {
  grantId: string;
  to: string[];
  cc?: string[];
  subject: string;
  /** HTML or plain text; Nylas sends whatever is given as the body. */
  body: string;
  replyTo?: string;
  /**
   * Threading. Given the provider's id for the message being answered, Nylas
   * sets Message-ID / In-Reply-To / References itself, so the reply lands in
   * the same conversation in the recipient's client instead of starting a
   * new one.
   */
  replyToMessageId?: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
  /** Deliver later. Nylas holds it and sends on time — see NYLAS_SCHEDULE_*. */
  sendAt?: Date;
}

export interface NylasSendResult {
  /** Present on an immediate send. */
  messageId: string;
  /** The conversation the message joined — the hook for matching replies. */
  threadId: string;
  /** Present instead of the ids above when the send was scheduled. */
  scheduleId: string | null;
}

/**
 * How far out Nylas will hold a message itself.
 *
 * Under two minutes it refuses (and a "schedule" that close is really just a
 * send); past thirty days it refuses too. Callers check these before
 * choosing between Nylas's scheduler and our own outbox — see
 * scheduleFitsNylas.
 */
export const NYLAS_SCHEDULE_MIN_MS = 2 * 60 * 1000;
export const NYLAS_SCHEDULE_MAX_MS = 30 * 24 * 60 * 60 * 1000;

/** Whether Nylas can hold this send, or our own outbox has to. */
export function scheduleFitsNylas(sendAt: Date, now: Date = new Date()): boolean {
  const delta = sendAt.getTime() - now.getTime();
  return delta >= NYLAS_SCHEDULE_MIN_MS && delta <= NYLAS_SCHEDULE_MAX_MS;
}

/** Send from a connected mailbox, now or at a set time. */
export async function sendViaNylas(input: NylasSendInput): Promise<NylasSendResult> {
  const addr = (a: string) => ({ email: a });
  const res = await fetch(
    `${host()}/v3/grants/${encodeURIComponent(input.grantId)}/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NYLAS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: input.to.map(addr),
        ...(input.cc?.length ? { cc: input.cc.map(addr) } : {}),
        ...(input.replyTo ? { reply_to: [addr(input.replyTo)] } : {}),
        subject: input.subject,
        body: input.body,
        ...(input.replyToMessageId ? { reply_to_message_id: input.replyToMessageId } : {}),
        // Unix *seconds*, not milliseconds — passing ms schedules the send
        // some fifty thousand years out, and Nylas accepts it without complaint.
        ...(input.sendAt ? { send_at: Math.floor(input.sendAt.getTime() / 1000) } : {}),
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                content_type: a.contentType ?? "application/octet-stream",
              })),
            }
          : {}),
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Nylas send failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    data?: { id?: string; thread_id?: string; schedule_id?: string | number };
  };
  const d = json.data ?? {};
  return {
    messageId: d.id ?? "",
    threadId: d.thread_id ?? "",
    scheduleId: d.schedule_id != null ? String(d.schedule_id) : null,
  };
}

/**
 * Call off a scheduled send. Nylas wants at least ten seconds' notice, so a
 * cancel racing the send time can legitimately fail — the caller has to treat
 * a rejection as "it went out", not as an error to swallow.
 */
export async function cancelNylasSchedule(grantId: string, scheduleId: string): Promise<boolean> {
  const res = await fetch(
    `${host()}/v3/grants/${encodeURIComponent(grantId)}/messages/schedules/${encodeURIComponent(scheduleId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${process.env.NYLAS_API_KEY}` } },
  );
  return res.ok;
}

/**
 * Verify an inbound notification: hex HMAC-SHA256 of the raw body under the
 * endpoint's webhook secret. The caller must pass the body exactly as
 * received — re-serialising parsed JSON changes the bytes and fails the
 * comparison for reasons that look nothing like a signature problem.
 */
export function verifyNylasWebhook(payload: string, signature: string | null): boolean {
  const secret = process.env.NYLAS_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
