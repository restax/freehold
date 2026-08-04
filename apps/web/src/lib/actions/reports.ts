"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";
import { sendTransactionReportNow } from "@/lib/transaction-status-report";

const REPORT_PATH = "/dashboard/reports/transactions";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRecipients(raw: string): string[] {
  const emails = raw
    .split(/[,\n]/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(emails)].filter((e) => EMAIL_RE.test(e));
}

/** The "Recreate" button. The page is already dynamic and re-fetches on
 *  every load, so this doesn't compute anything new — it clears the Next.js
 *  cache and bounces back with a timestamp, so the click has a visible
 *  result rather than looking like a dead button. */
export async function regenerateReport() {
  await requireTenant();
  revalidatePath(REPORT_PATH);
  redirect(`${REPORT_PATH}?generated=${Date.now()}`);
}

export async function sendTransactionReportNowAction(formData: FormData) {
  const { tenantId } = await requireTenant();
  const recipients = parseRecipients(String(formData.get("recipients") ?? ""));
  if (recipients.length === 0) {
    redirect(`${REPORT_PATH}?error=invalid`);
  }
  try {
    const result = await sendTransactionReportNow(tenantId, recipients);
    if (result.sent === 0) redirect(`${REPORT_PATH}?error=send`);
  } catch {
    redirect(`${REPORT_PATH}?error=send`);
  }
  redirect(`${REPORT_PATH}?sent=1`);
}

export async function saveTransactionReportScheduleAction(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;

  const frequency = String(formData.get("frequency") ?? "");
  const recipients = parseRecipients(String(formData.get("recipients") ?? ""));

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { emailSettings: true },
  });
  const current = (org.emailSettings as Record<string, unknown>) ?? {};

  if (frequency !== "weekly" && frequency !== "monthly") {
    // "Off" — clear the schedule.
    const { transactionReportSchedule: _drop, ...rest } = current;
    await prisma.organization.update({
      where: { id: tenantId },
      data: { emailSettings: rest as unknown as Record<string, string> },
    });
    redirect(`${REPORT_PATH}?schedule=off`);
  }

  if (recipients.length === 0) {
    redirect(`${REPORT_PATH}?error=invalid`);
  }

  await prisma.organization.update({
    where: { id: tenantId },
    data: {
      emailSettings: {
        ...current,
        transactionReportSchedule: { frequency, recipients },
      },
    },
  });
  redirect(`${REPORT_PATH}?schedule=on`);
}
