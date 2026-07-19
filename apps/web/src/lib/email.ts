import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma, withTenant } from "@freehold/db";

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
  to: string;
  subject: string;
  body: string;
  /** Optional branded HTML rendering; `body` remains the text fallback. */
  html?: string;
}

/** Send + record. Returns the stored Email id, or throws on provider errors. */
export async function sendTenantEmail(input: SendEmailInput): Promise<string> {
  if (!emailEnabled()) throw new Error("Email is not configured.");
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.tenantId },
    select: { name: true, slug: true },
  });
  const replyToken = randomBytes(12).toString("base64url");
  const from = `${org.name} <${org.slug}@${process.env.EMAIL_FROM_DOMAIN}>`;
  const replyTo = `reply+${replyToken}@${process.env.EMAIL_REPLY_DOMAIN}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      reply_to: replyTo,
      subject: input.subject,
      text: input.body,
      ...(input.html ? { html: input.html } : {}),
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
