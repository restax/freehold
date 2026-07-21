import { type ProposalKind, prisma, withTenant } from "@freehold/db";
import { parseVendorReply } from "@/lib/ai/vendor-reply";
import { tokenFromAddress, verifyResendWebhook } from "@/lib/email";
import { stripQuotedReply } from "@/lib/email-quote";
import { adminAlert } from "@/lib/notify";
import { putObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Resend webhook: inbound replies (email.received) thread back onto the
 * transaction via the reply token; delivery events update outbound status.
 * Signature-verified (svix scheme) before anything is trusted.
 *
 * Inbound handling closes the gaps that used to lose vendor replies:
 *  - unmatched mail (no token, or a token matching nothing) is captured in the
 *    inbound_email landing zone and an operator is alerted, never dropped;
 *  - attachments are saved as internal documents on the transaction;
 *  - quoted history is stripped before anything reads the body;
 *  - the sender is recorded and checked against who the order was emailed to.
 * A reply on an emailed-order thread is AI-read into a PROPOSAL the coordinator
 * confirms — it never touches the order automatically.
 */

interface InboundAttachment {
  filename: string;
  content: string; // base64
  contentType: string;
}

function readAttachments(data: Record<string, unknown>): InboundAttachment[] {
  const raw = Array.isArray(data.attachments) ? data.attachments : [];
  return raw
    .map((a) => {
      const at = a as Record<string, unknown>;
      return {
        filename: String(at.filename ?? at.name ?? "attachment"),
        content: typeof at.content === "string" ? at.content : "",
        contentType: String(at.content_type ?? at.contentType ?? "application/octet-stream"),
      };
    })
    .filter((a) => a.content);
}

/** Save inbound attachments as internal documents on a transaction. Best-effort. */
async function saveAttachments(
  tenantId: string,
  transactionId: string,
  orderId: string | null,
  attachments: InboundAttachment[],
): Promise<number> {
  let saved = 0;
  for (const att of attachments.slice(0, 10)) {
    try {
      const bytes = Buffer.from(att.content, "base64");
      if (bytes.length === 0 || bytes.length > 25 * 1024 * 1024) continue;
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
            // Vendor-origin files stay internal until the TC promotes them.
            visibleToClient: false,
            visibleToAgent: false,
            sourceOrderId: orderId,
          },
        }),
      );
      saved += 1;
    } catch {
      // One bad attachment must not sink the whole inbound.
    }
  }
  return saved;
}

function emailAddress(raw: string): string {
  return raw.match(/<([^>]+)>/)?.[1]?.toLowerCase() ?? raw.trim().toLowerCase();
}

function bodyText(data: Record<string, unknown>): string {
  if (typeof data.text === "string" && data.text.trim()) return data.text;
  if (typeof data.html === "string") {
    return data.html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

export async function POST(req: Request) {
  const payload = await req.text();
  const ok = verifyResendWebhook(payload, {
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
  });
  if (!ok) return new Response("Invalid signature", { status: 400 });

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  const data = event.data ?? {};

  if (event.type === "email.received" || event.type === "inbound.email.received") {
    const toList: string[] = Array.isArray(data.to)
      ? (data.to as string[])
      : typeof data.to === "string"
        ? [data.to]
        : [];
    const token = toList.map(tokenFromAddress).find(Boolean) ?? null;
    const from = typeof data.from === "string" ? data.from : String(data.from ?? "unknown");
    const subject = typeof data.subject === "string" ? data.subject : "Re: (no subject)";
    const rawBody = bodyText(data) || "(no text content)";
    const cleaned = stripQuotedReply(rawBody);
    const attachments = readAttachments(data);

    // Landing zone: no usable token → capture, alert, never drop.
    if (!token) {
      await prisma.inboundEmail.create({
        data: {
          fromAddr: from,
          toAddr: toList[0] ?? "",
          subject,
          bodyText: cleaned.slice(0, 20000),
          reason: "no_token",
          attachmentCount: attachments.length,
        },
      });
      adminAlert(`📥 Unmatched inbound email from ${from} (no reply token) — captured for review`);
      return new Response("ok (captured, no token)", { status: 200 });
    }

    const thread = await prisma.emailThread.findUnique({ where: { token } });
    if (!thread) {
      await prisma.inboundEmail.create({
        data: {
          fromAddr: from,
          toAddr: toList[0] ?? "",
          subject,
          bodyText: cleaned.slice(0, 20000),
          token,
          reason: "unknown_token",
          attachmentCount: attachments.length,
        },
      });
      adminAlert(`📥 Inbound email from ${from} with an unknown token — captured for review`);
      return new Response("ok (captured, unknown token)", { status: 200 });
    }

    // Always record the inbound on the thread and keep its attachments.
    await withTenant(thread.tenantId, (tx) =>
      tx.email.create({
        data: {
          tenantId: thread.tenantId,
          transactionId: thread.transactionId,
          contactId: thread.contactId,
          direction: "INBOUND",
          fromAddr: from,
          toAddr: toList[0] ?? "",
          subject,
          bodyText: cleaned.slice(0, 20000),
          replyToken: token,
          status: "RECEIVED",
        },
      }),
    );
    if (thread.transactionId && attachments.length > 0) {
      await saveAttachments(thread.tenantId, thread.transactionId, thread.orderId, attachments);
    }

    // Emailed-order thread: read the reply into a proposal for the TC to confirm.
    if (thread.orderId) {
      await proposeFromReply(thread.tenantId, thread.orderId, from, cleaned);
      adminAlert(`📨 Vendor reply on an order from ${from} — proposed an update for review`);
    } else {
      adminAlert(`📨 Reply captured on a transaction thread from ${from}`);
    }
    return new Response("ok", { status: 200 });
  }

  // Outbound delivery lifecycle: reflect provider status on the stored row.
  const providerId = typeof data.email_id === "string" ? data.email_id : null;
  const statusByType: Record<string, string> = {
    "email.delivered": "DELIVERED",
    "email.bounced": "BOUNCED",
    "email.complained": "COMPLAINED",
  };
  const status = event.type ? statusByType[event.type] : undefined;
  if (providerId && status) {
    const thread = await prisma.emailThread.findFirst({ where: { providerId } });
    if (thread) {
      await withTenant(thread.tenantId, (tx) =>
        tx.email.updateMany({ where: { providerId }, data: { status } }),
      ).catch(() => {});
    }
  }
  return new Response("ok", { status: 200 });
}

/**
 * Turn a vendor's plain reply into a PENDING proposal on the order. The AI read
 * is best-effort: if it's unavailable or errors, we still land a NOTE proposal
 * with the raw reply, so the coordinator always sees that the vendor responded.
 */
async function proposeFromReply(
  tenantId: string,
  orderId: string,
  from: string,
  text: string,
): Promise<void> {
  const order = await withTenant(tenantId, (tx) =>
    tx.vendorOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        vendorId: true,
        type: true,
        status: true,
        scheduledAt: true,
        emailTo: true,
      },
    }),
  );
  if (!order) return;

  const senderMismatch = Boolean(order.emailTo) && emailAddress(from) !== order.emailTo;

  // The reply is also a message in the order conversation, so the one thread
  // holds it regardless of whether it arrived by email or in-app.
  await withTenant(tenantId, (tx) =>
    tx.vendorOrderMessage.create({
      data: {
        tenantId,
        vendorId: order.vendorId,
        orderId,
        authorKind: "VENDOR",
        authorName: order.emailTo ?? from,
        body: text.slice(0, 8000),
        viaEmail: true,
      },
    }),
  );

  let kind: ProposalKind = "NOTE";
  let at: Date | null = null;
  let summary = text.slice(0, 200);
  try {
    const parsed = await parseVendorReply(text, {
      orderType: order.type,
      currentStatus: order.status,
      scheduledAt: order.scheduledAt,
      now: new Date(),
    });
    kind = parsed.kind as ProposalKind;
    summary = parsed.summary?.slice(0, 300) || summary;
    if (parsed.appointmentAt) {
      const parsedAt = new Date(parsed.appointmentAt);
      if (!Number.isNaN(parsedAt.getTime())) at = parsedAt;
    }
    // A schedule with no usable time is really just a note.
    if (kind === "SCHEDULE" && !at) kind = "NOTE";
  } catch {
    // Leave the NOTE fallback in place — the reply is preserved regardless.
  }

  await withTenant(tenantId, (tx) =>
    tx.vendorOrderProposal.create({
      data: {
        tenantId,
        orderId,
        kind,
        at,
        summary,
        sourceText: text.slice(0, 8000),
        fromAddr: from,
        senderMismatch,
      },
    }),
  );
}
