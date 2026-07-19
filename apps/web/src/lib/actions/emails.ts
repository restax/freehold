"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import { optStr, str } from "@/lib/forms";
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
  if (!transactionId || !to.includes("@") || !subject || !body) return;

  await sendTenantEmail({ tenantId, transactionId, contactId, to, subject, body });
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
