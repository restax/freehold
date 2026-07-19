"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { emailContextForTransaction } from "@/lib/auto-emails";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import { parseEmailSettings, renderEmailHtml } from "@/lib/email-template";
import { optStr, str } from "@/lib/forms";
import { getObjectBytes } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";

/** Compose from the transaction's Emails tab. */
export async function sendTransactionEmail(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  if (!emailEnabled()) return;
  const transactionId = str(formData, "transactionId");
  const to = str(formData, "to").trim();
  const subject = str(formData, "subject").trim();
  const body = str(formData, "body").trim();
  const contactId = optStr(formData, "contactId");
  const emailTemplateId = optStr(formData, "emailTemplateId");
  if (!transactionId || !to.includes("@") || !subject || !body) return;

  // Attachments: selected transaction documents, decrypted, capped at 15 MB.
  const attachDocIds = formData.getAll("attachDoc").map(String).filter(Boolean);
  const attachments: Array<{ filename: string; content: string }> = [];
  if (attachDocIds.length > 0) {
    const docs = await withTenant(tenantId, (tx) =>
      tx.document.findMany({
        where: { id: { in: attachDocIds }, transactionId },
        select: { filename: true, data: true, storageKey: true },
      }),
    );
    let total = 0;
    for (const doc of docs) {
      const bytes = await getObjectBytes(doc);
      total += bytes.length;
      if (total > 15 * 1024 * 1024) break;
      attachments.push({ filename: doc.filename, content: bytes.toString("base64") });
    }
  }

  if (emailTemplateId) {
    // Usage analytics for the template studio; never blocks the send.
    withTenant(tenantId, (tx) =>
      tx.emailTemplate.update({
        where: { id: emailTemplateId },
        data: { usageCount: { increment: 1 } },
      }),
    ).catch(() => {});
  }

  // "Send later": exact schedule chosen by the TC → outbox (branded HTML
  // renders at flush time). Quiet hours don't apply to explicit schedules.
  const sendAtRaw = optStr(formData, "sendAt");
  if (sendAtRaw) {
    const sendAt = new Date(sendAtRaw);
    if (!Number.isNaN(sendAt.getTime()) && sendAt.getTime() > Date.now()) {
      const { prisma } = await import("@freehold/db");
      await prisma.emailOutbox.create({
        data: { tenantId, transactionId, toAddr: to, subject, body, sendAt },
      });
      logAudit({
        tenantId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "email.scheduled",
        summary: `Scheduled email to ${to} for ${sendAt.toISOString()}: "${subject.slice(0, 60)}"`,
        subjectType: "transaction",
        subjectId: transactionId,
      });
      revalidatePath(`/dashboard/transactions/${transactionId}`);
      return;
    }
  }

  const ctx = await emailContextForTransaction(tenantId, transactionId, session.user);
  await sendTenantEmail({
    tenantId,
    transactionId,
    contactId,
    to,
    subject,
    body,
    attachments,
    ...(ctx
      ? {
          html: renderEmailHtml({
            tenantName: ctx.org.name,
            body,
            tc: ctx.tcCard,
            agent: ctx.agentCard,
            otherSide: ctx.otherCard,
            ...parseEmailSettings(ctx.org.emailSettings),
          }),
        }
      : {}),
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "email.sent",
    summary: `Emailed ${to}: "${subject.slice(0, 80)}"`,
    subjectType: "transaction",
    subjectId: transactionId,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/** Cancel a scheduled (outbox) email before it sends. */
export async function cancelScheduledEmail(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id) return;
  const { prisma } = await import("@freehold/db");
  await prisma.emailOutbox.updateMany({
    where: { id, tenantId, sentAt: null },
    data: { canceledAt: new Date() },
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
