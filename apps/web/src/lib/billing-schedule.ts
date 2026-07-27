import { prisma, withTenant } from "@freehold/db";
import { type AttributableInvoice, committedCents } from "./billing";
import { consolidatedDueToday, consolidationLabel, todayParts } from "./billing-cadence";
import { clientBillingPolicy } from "./billing-policy";
import { invoiceLabel, nextInvoiceNumber } from "./invoicing";
import { parseQuietHours } from "./outbox";
import { fmtCents } from "./pay";
import { getTenantPlan, isCloud } from "./plans";

/**
 * Scheduled consolidated billing: clients on the monthly or weekly rhythm get
 * one DRAFT invoice per period rolling up every closed file of theirs with an
 * unbilled remainder — one line per file, reviewed and issued by a person,
 * never auto-sent. Runs from the nightly cron; a review task is opened so the
 * draft can't sit unnoticed.
 *
 * Two properties keep this trustworthy:
 *  - Files are included only once *closed* — a TC's fee is earned at closing,
 *    so a file open for three months bills in the month it closes, not before.
 *  - Idempotent by arithmetic, like every drafting path: each file's line is
 *    its expected fee minus what's already issued or drafted (committedCents),
 *    so a re-run — or a boundary day the cron fires twice — adds nothing.
 */

export interface ScheduledBillingSummary {
  workspaces: number;
  drafts: number;
  files: number;
  cents: number;
}

export async function runScheduledBilling(
  now: Date = new Date(),
): Promise<ScheduledBillingSummary> {
  const summary: ScheduledBillingSummary = { workspaces: 0, drafts: 0, files: 0, cents: 0 };
  const orgs = await prisma.organization.findMany({
    select: { id: true, billingDefaults: true, emailSettings: true },
  });

  for (const org of orgs) {
    try {
      if (isCloud()) {
        const plan = await getTenantPlan(org.id);
        if (plan.tier !== "PRO" && plan.tier !== "BUSINESS") continue;
      }
      const { timeZone } = parseQuietHours(org.emailSettings);
      const parts = todayParts(now, timeZone);

      const made = await withTenant(org.id, async (tx) => {
        const clients = await tx.client.findMany({
          select: { id: true, name: true, billingConfig: true },
        });
        const due = clients.filter((c) => {
          const mode = clientBillingPolicy(org.billingDefaults, c.billingConfig).mode;
          return consolidatedDueToday(mode, parts);
        });
        if (due.length === 0) return 0;

        let drafts = 0;
        for (const client of due) {
          const mode = clientBillingPolicy(org.billingDefaults, client.billingConfig).mode;
          const files = await tx.transaction.findMany({
            where: { clientId: client.id, status: "CLOSED", expectedFeeCents: { gt: 0 } },
            select: { id: true, propertyAddress: true, expectedFeeCents: true },
          });
          if (files.length === 0) continue;
          const ids = files.map((f) => f.id);
          const invoices: AttributableInvoice[] = await tx.invoice.findMany({
            where: {
              OR: [
                { transactionId: { in: ids } },
                { lines: { some: { transactionId: { in: ids } } } },
              ],
            },
            select: {
              status: true,
              provider: true,
              transactionId: true,
              amountCents: true,
              lines: { select: { transactionId: true, amountCents: true } },
              payments: { select: { amountCents: true } },
            },
          });
          const lines = files
            .map((f) => ({
              transactionId: f.id,
              description: `Transaction coordination: ${f.propertyAddress}`,
              amountCents: Math.max(0, (f.expectedFeeCents ?? 0) - committedCents(f.id, invoices)),
            }))
            .filter((l) => l.amountCents > 0);
          if (lines.length === 0) continue;

          const total = lines.reduce((s, l) => s + l.amountCents, 0);
          const number = await nextInvoiceNumber(tx, org.id);
          const invoice = await tx.invoice.create({
            data: {
              tenantId: org.id,
              clientId: client.id,
              number,
              status: "DRAFT",
              description: consolidationLabel(mode, now, timeZone),
              amountCents: total,
              lines: {
                create: lines.map((l, i) => ({
                  tenantId: org.id,
                  transactionId: l.transactionId,
                  kind: "service",
                  description: l.description,
                  amountCents: l.amountCents,
                  sortOrder: i,
                })),
              },
            },
          });
          // The draft must not sit unnoticed: an undated review lands at the
          // top of today's list, closing when someone deals with the draft.
          await tx.task.create({
            data: {
              tenantId: org.id,
              title: `Review ${invoiceLabel(invoice.number)} — ${client.name} (${fmtCents(total)}, ${lines.length} file${lines.length === 1 ? "" : "s"})`,
              dueDate: now,
            },
          });
          drafts += 1;
          summary.files += lines.length;
          summary.cents += total;
        }
        return drafts;
      });
      if (made > 0) {
        summary.workspaces += 1;
        summary.drafts += made;
      }
    } catch {
      // One workspace's bad data must never stall the whole nightly run.
    }
  }
  return summary;
}
