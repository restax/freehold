import { prisma, withTenant } from "@freehold/db";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import { fmtCents } from "@/lib/pay";
import { agingBucket, type OutstandingLine, outstandingReportText } from "./invoicing";

/**
 * The morning invoice report: every workspace that picked a recipient
 * (Settings → Invoice report) gets its outstanding invoices emailed to that
 * one user — a working list for whoever chases the money. Mornings with
 * nothing outstanding send nothing; an empty nag is just noise.
 */

export interface InvoiceReportRunSummary {
  workspaces: number;
  sent: number;
  errors: number;
}

export async function runInvoiceReports(): Promise<InvoiceReportRunSummary> {
  const summary: InvoiceReportRunSummary = { workspaces: 0, sent: 0, errors: 0 };
  if (!emailEnabled()) return summary;

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, emailSettings: true },
  });
  const optedIn = orgs.flatMap((o) => {
    const userId = (o.emailSettings as { invoiceReportUserId?: string } | null)
      ?.invoiceReportUserId;
    return userId ? [{ id: o.id, name: o.name, userId }] : [];
  });
  summary.workspaces = optedIn.length;

  for (const org of optedIn) {
    try {
      // The recipient must still be a member; a departed user ends the report
      // rather than mailing a stranger.
      const member = await prisma.member.findFirst({
        where: { organizationId: org.id, userId: org.userId },
        select: { user: { select: { email: true } } },
      });
      if (!member?.user.email) continue;

      const outstanding = await withTenant(org.id, (tx) =>
        tx.invoice.findMany({
          where: { status: "SENT" },
          orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { number: "asc" }],
          select: {
            number: true,
            amountCents: true,
            dueDate: true,
            client: { select: { name: true } },
            transaction: { select: { propertyAddress: true } },
          },
        }),
      );
      if (outstanding.length === 0) continue;

      const lines: OutstandingLine[] = outstanding.map((i) => ({
        number: i.number,
        clientName: i.client?.name ?? null,
        amountCents: i.amountCents,
        dueDate: i.dueDate,
        address: i.transaction?.propertyAddress ?? null,
      }));
      const overdueCount = lines.filter((l) => agingBucket(l.dueDate) === "overdue").length;
      const total = lines.reduce((s, l) => s + l.amountCents, 0);

      await sendTenantEmail({
        tenantId: org.id,
        to: member.user.email,
        subject: `Outstanding invoices — ${fmtCents(total)} across ${lines.length}${
          overdueCount > 0 ? `, ${overdueCount} overdue` : ""
        }`,
        body: outstandingReportText(lines, org.name),
      }).then(
        () => {
          summary.sent += 1;
        },
        () => {
          summary.errors += 1;
        },
      );
    } catch {
      summary.errors += 1;
    }
  }
  return summary;
}
