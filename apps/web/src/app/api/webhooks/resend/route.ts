import { prisma, withTenant } from "@freehold/db";
import { tokenFromAddress, verifyResendWebhook } from "@/lib/email";
import { adminAlert } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Resend webhook: inbound replies (email.received) thread back onto the
 * transaction via the reply token; delivery events update outbound status.
 * Signature-verified (svix scheme) before anything is trusted.
 */
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
    if (!token) return new Response("ok (no thread token)", { status: 200 });

    const original = await prisma.emailThread.findUnique({ where: { token } });
    if (!original) return new Response("ok (unknown token)", { status: 200 });

    const from = typeof data.from === "string" ? data.from : String(data.from ?? "unknown");
    const subject = typeof data.subject === "string" ? data.subject : "Re: (no subject)";
    const text =
      typeof data.text === "string" && data.text.trim()
        ? data.text
        : typeof data.html === "string"
          ? data.html
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
          : "(no text content)";

    await withTenant(original.tenantId, (tx) =>
      tx.email.create({
        data: {
          tenantId: original.tenantId,
          transactionId: original.transactionId,
          contactId: original.contactId,
          direction: "INBOUND",
          fromAddr: from,
          toAddr: toList[0] ?? "",
          subject,
          bodyText: text.slice(0, 20000),
          replyToken: token,
          status: "RECEIVED",
        },
      }),
    );
    adminAlert(`📨 Reply captured on a transaction thread from ${from}`);
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
