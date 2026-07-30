"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { logAudit } from "@/lib/audit";
import { emailContextForTransaction } from "@/lib/auto-emails";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import { parseEmailSettings, renderEmailHtml } from "@/lib/email-template";
import { optStr, str } from "@/lib/forms";
import { cancelScheduled, scheduleEmail } from "@/lib/outbox";
import { getObjectBytes } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";

/** Compose from the transaction's Emails tab. */
export async function sendTransactionEmail(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  if (!emailEnabled()) return;
  const transactionId = str(formData, "transactionId");
  const to = str(formData, "to").trim();
  const cc = optStr(formData, "cc");
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
        select: {
          filename: true,
          data: true,
          storageKey: true,
          storageProvider: true,
          tenantId: true,
        },
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

  // Who it goes out as. The checkbox only appears when a mailbox is
  // connected, but the flag is re-checked in sendTenantEmail rather than
  // trusted from the form.
  const sendAsUserId = optStr(formData, "sendAsSelf") ? session.user.id : null;

  const ctx = await emailContextForTransaction(tenantId, transactionId, session.user);
  const html = ctx
    ? renderEmailHtml({
        tenantName: ctx.org.name,
        body,
        tc: ctx.tcCard,
        agent: ctx.agentCard,
        otherSide: ctx.otherCard,
        ...parseEmailSettings(ctx.org.emailSettings),
      })
    : undefined;

  // "Send later": exact schedule chosen by the TC. Held by Nylas when it's
  // going out from their own mailbox (delivered on the minute), otherwise by
  // our outbox. Quiet hours don't apply to explicit schedules.
  const sendAtRaw = optStr(formData, "sendAt");
  if (sendAtRaw) {
    const sendAt = new Date(sendAtRaw);
    if (!Number.isNaN(sendAt.getTime()) && sendAt.getTime() > Date.now()) {
      await scheduleEmail({
        tenantId,
        transactionId,
        to,
        subject,
        body,
        html,
        sendAt,
        sendAsUserId,
        attachments,
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

  await sendTenantEmail({
    tenantId,
    transactionId,
    contactId,
    to,
    ...(cc ? { extraCc: cc } : {}),
    subject,
    body,
    attachments,
    sendAsUserId,
    ...(html ? { html } : {}),
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
  logActivity({
    tenantId,
    transactionId,
    actor: session.user,
    action: "email.sent",
    summary: `Emailed ${to} — “${subject.slice(0, 60)}”`,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/**
 * Cancel a scheduled email before it sends.
 *
 * A Nylas-held schedule needs ten seconds' notice, so this can lose the race
 * — cancelScheduled says so rather than marking the row cancelled for mail
 * that has already left.
 */
export async function cancelScheduledEmail(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id) return;
  await cancelScheduled(id, tenantId);
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
