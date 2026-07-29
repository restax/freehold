import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma, withTenant } from "@freehold/db";
import { parseEmailSettings } from "@/lib/email-template";
import { nylasEnabled, sendViaNylas } from "@/lib/nylas";

/**
 * Transactional email with reply capture, via Resend. No IMAP, no SMTP, no
 * OAuth reviews: outbound goes through Resend's REST API from the tenant's
 * identity on the shared mail domain, and replies arrive on the inbound
 * webhook addressed to reply+<token>@ the reply domain.
 *
 * Config (all env-gated; without them email features show a setup note):
 * - RESEND_API_KEY
 * - EMAIL_FROM_DOMAIN   e.g. mail.freeholdtc.dev  (verified in Resend)
 * - EMAIL_REPLY_DOMAIN  e.g. reply.freeholdtc.dev (MX → Resend inbound)
 * - RESEND_WEBHOOK_SECRET (svix signing secret for the inbound/events webhook)
 */

export function emailEnabled(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY && process.env.EMAIL_FROM_DOMAIN && process.env.EMAIL_REPLY_DOMAIN,
  );
}

export interface SendEmailInput {
  tenantId: string;
  transactionId?: string | null;
  contactId?: string | null;
  /** Set for a vendor order emailed to an unregistered vendor: their reply
   *  routes to the AI-proposal path instead of plain thread capture. */
  orderId?: string | null;
  to: string;
  subject: string;
  body: string;
  /** Optional branded HTML rendering; `body` remains the text fallback. */
  html?: string;
  /** Optional attachments (base64 content), capped by the caller. */
  attachments?: Array<{ filename: string; content: string }>;
  /**
   * Send from this user's own connected mailbox instead of the workspace's
   * shared address. Falls back to the shared address if they haven't
   * connected one, or their grant has gone invalid — a send never fails
   * merely because someone's mailbox came unlinked.
   */
  sendAsUserId?: string | null;
}

/** Whether this user can send as themselves right now. */
export async function canSendAsSelf(userId: string): Promise<boolean> {
  if (!nylasEnabled()) return false;
  const grant = await prisma.nylasGrant.findUnique({
    where: { userId },
    select: { status: true },
  });
  return grant?.status === "valid";
}

/** Send + record. Returns the stored Email id, or throws on provider errors. */
export async function sendTenantEmail(input: SendEmailInput): Promise<string> {
  // The coordinator's own mailbox, when they've asked for it and it works.
  // Resolved before the shared-address guard below: sending as yourself
  // doesn't need EMAIL_FROM_DOMAIN or a Resend key at all.
  const grant = input.sendAsUserId
    ? await prisma.nylasGrant.findUnique({
        where: { userId: input.sendAsUserId },
        select: { grantId: true, email: true, status: true },
      })
    : null;
  const asSelf = grant?.status === "valid" && nylasEnabled();

  if (!asSelf && !emailEnabled()) throw new Error("Email is not configured.");
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.tenantId },
    select: { name: true, slug: true, emailSettings: true },
  });
  const replyToken = randomBytes(12).toString("base64url");
  const from = `${org.name} <${org.slug}@${process.env.EMAIL_FROM_DOMAIN}>`;
  const replyTo = `reply+${replyToken}@${process.env.EMAIL_REPLY_DOMAIN}`;

  // Workspace CC on transaction email: the "CC on all transactions" address is
  // added automatically here. Only for transaction-scoped mail, and never when
  // it's also the recipient (no pointless self-CC).
  const ccAddr = input.transactionId ? (parseEmailSettings(org.emailSettings).cc ?? "").trim() : "";

  // The second person on a contact record — an assistant, a spouse — is copied
  // on everything sent to that contact. That's the whole reason one record
  // holds two people: keeping them in the loop shouldn't depend on whoever is
  // composing remembering to add them. Done here rather than at each call site
  // so every path that mails a contact behaves the same way.
  const partner = input.contactId
    ? await withTenant(input.tenantId, async (tx) => {
        const c = await tx.contact.findUnique({
          where: { id: input.contactId as string },
          select: { secondary: true },
        });
        const second = c?.secondary as { email?: string } | null;
        return (second?.email ?? "").trim();
      }).catch(() => "")
    : "";

  const already = new Set([input.to.trim().toLowerCase()]);
  const cc = [ccAddr, partner]
    .map((a) => a.trim())
    .filter((a) => {
      if (!a || already.has(a.toLowerCase())) return false;
      already.add(a.toLowerCase());
      return true;
    });

  // Sending as the coordinator: from their real address, and deliberately
  // *without* a reply+<token> Reply-To. Rewriting it would send the reply
  // back to Freehold instead of the person the recipient thinks they're
  // talking to, which is the one thing this feature exists to avoid. Replies
  // land in their mailbox and reach the file through the Nylas thread id.
  if (asSelf && grant) {
    const sent = await sendViaNylas({
      grantId: grant.grantId,
      to: [input.to],
      cc,
      subject: input.subject,
      // Their mail client shows what their recipient will see, so the branded
      // wrapper goes on here too when there is one.
      body: input.html ?? input.body,
      attachments: input.attachments,
    });
    const storedSelf = await withTenant(input.tenantId, (tx) =>
      tx.email.create({
        data: {
          tenantId: input.tenantId,
          transactionId: input.transactionId ?? null,
          contactId: input.contactId ?? null,
          direction: "OUTBOUND",
          fromAddr: grant.email,
          toAddr: input.to,
          subject: input.subject,
          bodyText: input.body,
          providerId: sent.messageId || null,
          nylasThreadId: sent.threadId || null,
          nylasSentBy: input.sendAsUserId ?? null,
          status: "SENT",
        },
      }),
    );
    return storedSelf.id;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      ...(cc.length > 0 ? { cc } : {}),
      reply_to: replyTo,
      subject: input.subject,
      text: input.body,
      ...(input.html ? { html: input.html } : {}),
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { id?: string };

  await prisma.emailThread.create({
    data: {
      token: replyToken,
      tenantId: input.tenantId,
      transactionId: input.transactionId ?? null,
      contactId: input.contactId ?? null,
      orderId: input.orderId ?? null,
      providerId: json.id ?? null,
    },
  });

  const stored = await withTenant(input.tenantId, (tx) =>
    tx.email.create({
      data: {
        tenantId: input.tenantId,
        transactionId: input.transactionId ?? null,
        contactId: input.contactId ?? null,
        direction: "OUTBOUND",
        fromAddr: from,
        toAddr: input.to,
        subject: input.subject,
        bodyText: input.body,
        replyToken,
        providerId: json.id ?? null,
        status: "SENT",
      },
    }),
  );
  return stored.id;
}

/**
 * Svix-style webhook signature verification (Resend signs with svix):
 * signedContent = `${id}.${timestamp}.${payload}`, HMAC-SHA256 with the
 * base64 secret after the `whsec_` prefix, compared against the v1 entries
 * in the svix-signature header.
 */
export function verifyResendWebhook(
  payload: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const tsSeconds = Number(headers.timestamp);
  if (!Number.isFinite(tsSeconds) || Math.abs(Date.now() / 1000 - tsSeconds) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${headers.id}.${headers.timestamp}.${payload}`)
    .digest("base64");
  return headers.signature.split(" ").some((part) => {
    const [, sig] = part.split(",");
    if (!sig) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/** Match an inbound reply address (reply+<token>@…) back to its thread. */
export function tokenFromAddress(addr: string): string | null {
  const m = addr.match(/reply\+([A-Za-z0-9_-]+)@/);
  return m?.[1] ?? null;
}
