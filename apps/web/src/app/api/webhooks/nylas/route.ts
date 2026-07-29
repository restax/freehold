import { prisma, withTenant } from "@freehold/db";
import { stripQuotedReply } from "@/lib/email-quote";
import { adminAlert } from "@/lib/notify";
import { downloadNylasAttachment, fetchNylasMessage, verifyNylasWebhook } from "@/lib/nylas";
import { putObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Nylas webhook: inbound replies on a coordinator's own mailbox thread back
 * onto the transaction, and a broken connection flips the grant invalid the
 * moment Nylas notices rather than the next time someone tries to send.
 *
 * **Why this is quieter than the Resend webhook.** Resend's inbound address
 * is on our own domain — anything that reaches it is, by construction, about
 * Freehold, so an unmatched message goes to the InboundEmail landing zone
 * and pages an operator. A connected Nylas grant is a coordinator's actual
 * Gmail: message.created fires for *every* message that lands there, related
 * to a transaction or not. Landing every one of those or alerting on it would
 * flood the operator with someone's ordinary inbox traffic. So here,
 * "doesn't match a thread we started" is the expected, silent case — only a
 * genuine match gets recorded.
 */

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Save inbound attachments as internal documents on a transaction. Best-effort. */
async function saveAttachments(
  tenantId: string,
  transactionId: string,
  grantId: string,
  messageId: string,
  attachments: Array<{ id: string; filename: string; sizeBytes: number; contentType: string }>,
): Promise<void> {
  for (const att of attachments.slice(0, 10)) {
    if (att.sizeBytes > 25 * 1024 * 1024) continue;
    try {
      const bytes = await downloadNylasAttachment(grantId, messageId, att.id);
      if (bytes.length === 0) continue;
      const put = await putObject(tenantId, att.filename, bytes, att.contentType);
      await withTenant(tenantId, (tx) =>
        tx.document.create({
          data: {
            tenantId,
            transactionId,
            filename: att.filename,
            contentType: att.contentType,
            sizeBytes: bytes.length,
            data: put.data,
            storageKey: put.storageKey,
            storageProvider: put.storageProvider,
            // Same default as the Resend path: internal until the TC promotes it.
            visibleToClient: false,
            visibleToAgent: false,
          },
        }),
      );
    } catch {
      // One bad attachment must not sink the whole inbound message.
    }
  }
}

/** The verification handshake Nylas runs when a webhook is created or reactivated. */
export async function GET(req: Request) {
  const challenge = new URL(req.url).searchParams.get("challenge");
  if (!challenge) return new Response("Missing challenge", { status: 400 });
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(req: Request) {
  const payload = await req.text();
  if (!verifyNylasWebhook(payload, req.headers.get("x-nylas-signature"))) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  const obj = event.data?.object ?? {};
  const type = event.type ?? "";

  // Nylas's own sync health check caught a broken connection. The profile
  // page's "Needs reconnecting" state, and the compose control disappearing,
  // both depend on status flipping here rather than staying "valid" until
  // the next doomed send attempt fails.
  if (type === "grant.expired") {
    const grantId = typeof obj.id === "string" ? obj.id : "";
    if (grantId) {
      await prisma.nylasGrant.updateMany({
        where: { grantId },
        data: {
          status: "invalid",
          lastError: "Your mail provider ended this connection.",
        },
      });
    }
    return new Response("ok", { status: 200 });
  }

  // Covers message.created, .truncated, .cleaned, and their combinations —
  // the full message is always re-fetched below regardless of which fired.
  if (type.startsWith("message.created")) {
    const messageId = typeof obj.id === "string" ? obj.id : "";
    const grantId = typeof obj.grant_id === "string" ? obj.grant_id : "";
    if (!messageId || !grantId) return new Response("ok", { status: 200 });

    // The sent copy of something sendViaNylas just sent, notifying on itself.
    // Without this check, every outbound send would immediately re-record
    // its own content as an inbound reply to itself. Looked up on NylasSend,
    // not Email — Email has RLS, and this runs before any tenant is known.
    const ownSend = await prisma.nylasSend.findUnique({ where: { providerId: messageId } });
    if (ownSend) return new Response("ok (own send)", { status: 200 });

    let full: Awaited<ReturnType<typeof fetchNylasMessage>>;
    try {
      full = await fetchNylasMessage(grantId, messageId);
    } catch {
      // Transient Nylas error. There's nothing to retry against — the next
      // message on the same thread, if any, gets another chance.
      return new Response("ok (fetch failed)", { status: 200 });
    }

    const match = full.threadId
      ? await prisma.nylasSend.findFirst({
          where: { nylasThreadId: full.threadId },
          orderBy: { createdAt: "desc" },
        })
      : null;

    // No thread we started — routine mailbox traffic. Silent, on purpose;
    // see the module comment for why this isn't a landing zone.
    if (!match) return new Response("ok (unrelated)", { status: 200 });

    const from = full.from[0]?.email || "unknown";
    const cleaned = stripQuotedReply(htmlToText(full.body)) || "(no text content)";

    await withTenant(match.tenantId, (tx) =>
      tx.email.create({
        data: {
          tenantId: match.tenantId,
          transactionId: match.transactionId,
          contactId: match.contactId,
          direction: "INBOUND",
          fromAddr: from,
          toAddr: full.to[0]?.email ?? "",
          subject: full.subject || "Re: (no subject)",
          bodyText: cleaned.slice(0, 20000),
          providerId: messageId,
          nylasThreadId: full.threadId,
          status: "RECEIVED",
        },
      }),
    );

    if (match.transactionId && full.attachments.length > 0) {
      await saveAttachments(
        match.tenantId,
        match.transactionId,
        grantId,
        messageId,
        full.attachments,
      );
    }
    adminAlert(`📨 Reply from ${from} landed on a transaction via a coordinator's own mailbox`);
    return new Response("ok", { status: 200 });
  }

  return new Response("ok", { status: 200 });
}
