import { prisma, TransactionStatus, withTenant } from "@freehold/db";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import { fmtCents } from "@/lib/pay";
import type { EmailAccent } from "@/lib/theme";
import { parseAppearance, resolveEmailAccent } from "@/lib/theme";
import { renderBrandedEnvelope } from "./email-template";

/**
 * The transaction status report: every file grouped by pipeline stage, with
 * a KPI band and an overdue-tasks callout up top. Shown live at
 * /dashboard/reports/transactions, sendable on demand, and schedulable —
 * mirrors the shape of runInvoiceReports (lib/invoice-report.ts): the
 * schedule lives in Organization.emailSettings rather than its own table,
 * since it's a single per-workspace opt-in, not a list of independent rows.
 */

const STAGE_ORDER: Array<{ key: string; label: string; statuses: TransactionStatus[] }> = [
  { key: "coming_soon", label: "Coming soon", statuses: [TransactionStatus.COMING_SOON] },
  {
    key: "active",
    label: "Active listings",
    statuses: [TransactionStatus.ACTIVE, TransactionStatus.TMP_OFF_MARKET],
  },
  { key: "pending", label: "Pending", statuses: [TransactionStatus.PENDING] },
  { key: "under_contract", label: "Under contract", statuses: [TransactionStatus.UNDER_CONTRACT] },
  { key: "closed", label: "Closed", statuses: [TransactionStatus.CLOSED] },
];

export interface ReportRow {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  clientName: string | null;
  side: string;
  priceCents: number;
  closeDate: Date | null;
  openTasks: number;
  overdueTasks: number;
}

export interface ReportStage {
  key: string;
  label: string;
  volumeCents: number;
  rows: ReportRow[];
}

export interface OverdueItem {
  transactionId: string;
  address: string;
  taskTitle: string;
  dueDate: Date;
  notes: string | null;
}

export interface ReportData {
  generatedAt: Date;
  fileCount: number;
  clientCount: number;
  activeVolumeCents: number;
  closedVolumeCents: number;
  openTasks: number;
  overdueTasks: number;
  collectedThisMonthCents: number;
  overdueItems: OverdueItem[];
  stages: ReportStage[];
}

/** Everything on screen, live — not filtered to non-sample rows, so the
 *  report always matches what /dashboard/transactions itself shows. */
export async function buildTransactionStatusReport(tenantId: string): Promise<ReportData> {
  return withTenant(tenantId, async (tx) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [transactions, distinctClients, collected] = await Promise.all([
      tx.transaction.findMany({
        orderBy: [{ closeDate: { sort: "asc", nulls: "last" } }, { propertyAddress: "asc" }],
        select: {
          id: true,
          propertyAddress: true,
          city: true,
          state: true,
          status: true,
          side: true,
          purchasePrice: true,
          listPrice: true,
          closeDate: true,
          client: { select: { name: true } },
          tasks: {
            where: { status: "OPEN" },
            select: { id: true, title: true, dueDate: true, notes: true },
          },
        },
      }),
      tx.transaction.findMany({
        where: { clientId: { not: null } },
        distinct: ["clientId"],
        select: { clientId: true },
      }),
      tx.invoicePayment.aggregate({
        where: { receivedAt: { gte: monthStart } },
        _sum: { amountCents: true },
      }),
    ]);

    const rows: (ReportRow & { status: TransactionStatus })[] = transactions.map((t) => {
      const overdueTasks = t.tasks.filter((task) => task.dueDate && task.dueDate < now);
      return {
        id: t.id,
        address: t.propertyAddress,
        city: t.city,
        state: t.state,
        clientName: t.client?.name ?? null,
        side: t.side === "BUY_SIDE" ? "Buy side" : t.side === "SELL_SIDE" ? "Sell side" : "Dual",
        priceCents: (t.purchasePrice ?? t.listPrice ?? 0) * 100,
        closeDate: t.closeDate,
        openTasks: t.tasks.length,
        overdueTasks: overdueTasks.length,
        status: t.status,
      };
    });

    const overdueItems: OverdueItem[] = transactions.flatMap((t) =>
      t.tasks
        .filter((task): task is typeof task & { dueDate: Date } =>
          task.dueDate ? task.dueDate < now : false,
        )
        .map((task) => ({
          transactionId: t.id,
          address: t.propertyAddress,
          taskTitle: task.title,
          dueDate: task.dueDate as Date,
          notes: task.notes,
        })),
    );
    overdueItems.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const stages: ReportStage[] = STAGE_ORDER.map((s) => {
      const stageRows = rows.filter((r) => s.statuses.includes(r.status));
      return {
        key: s.key,
        label: s.label,
        volumeCents: stageRows.reduce((sum, r) => sum + r.priceCents, 0),
        rows: stageRows.map(({ status: _status, ...r }) => r),
      };
    });

    const closedVolumeCents = stages.find((s) => s.key === "closed")?.volumeCents ?? 0;
    const activeVolumeCents = rows.reduce((sum, r) => sum + r.priceCents, 0) - closedVolumeCents;

    return {
      generatedAt: now,
      fileCount: transactions.length,
      clientCount: distinctClients.length,
      activeVolumeCents,
      closedVolumeCents,
      openTasks: rows.reduce((sum, r) => sum + r.openTasks, 0),
      overdueTasks: overdueItems.length,
      collectedThisMonthCents: collected._sum.amountCents ?? 0,
      overdueItems,
      stages,
    };
  });
}

// ---------- rendering ----------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function transactionStatusReportText(data: ReportData, workspaceName: string): string {
  const lines: string[] = [];
  lines.push(`${workspaceName} — Transaction status report`);
  lines.push(`Generated ${data.generatedAt.toLocaleString("en-US")}`);
  lines.push("");
  lines.push(
    `${data.fileCount} files, ${data.clientCount} clients. Active pipeline ${fmtCents(data.activeVolumeCents)}, closed ${fmtCents(data.closedVolumeCents)}. Collected this month ${fmtCents(data.collectedThisMonthCents)}. ${data.openTasks} open tasks, ${data.overdueTasks} overdue.`,
  );
  if (data.overdueItems.length > 0) {
    lines.push("");
    lines.push("OVERDUE");
    for (const o of data.overdueItems) {
      lines.push(`- ${o.taskTitle} — ${o.address} (due ${fmtShortDate(o.dueDate)})`);
    }
  }
  for (const stage of data.stages) {
    if (stage.rows.length === 0) continue;
    lines.push("");
    lines.push(
      `${stage.label.toUpperCase()} (${stage.rows.length}, ${fmtCents(stage.volumeCents)})`,
    );
    for (const r of stage.rows) {
      const close = r.closeDate ? `closes ${fmtShortDate(r.closeDate)}` : "no contract date";
      lines.push(
        `- ${r.address}${r.city ? `, ${r.city}` : ""} — ${r.clientName ?? "no client"} — ${fmtCents(r.priceCents)} — ${close} — ${r.openTasks} open${r.overdueTasks > 0 ? `, ${r.overdueTasks} overdue` : ""}`,
      );
    }
  }
  return lines.join("\n");
}

export function transactionStatusReportHtml(
  data: ReportData,
  workspaceName: string,
  accent: EmailAccent,
): string {
  const stat = (label: string, value: string) =>
    `<td style="padding:8px 12px;border:1px solid #e7e5e4;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#a8a29e;">${esc(label)}</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:#1c1917;">${esc(value)}</p>
    </td>`;

  const kpiTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;"><tr>
    ${stat("Active pipeline", fmtCents(data.activeVolumeCents))}
    ${stat("Closed", fmtCents(data.closedVolumeCents))}
    ${stat("Collected (mo.)", fmtCents(data.collectedThisMonthCents))}
    ${stat("Overdue", String(data.overdueTasks))}
  </tr></table>`;

  const overdueHtml =
    data.overdueItems.length > 0
      ? `<div style="border:1px solid #dc9a8f;background:#fdf1ee;border-radius:6px;padding:12px 14px;margin:0 0 18px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#a63b2e;">Attention needed &mdash; ${data.overdueItems.length} overdue</p>
        ${data.overdueItems
          .map(
            (o) =>
              `<p style="margin:0 0 4px;font-size:13px;color:#44201b;"><strong>${esc(o.taskTitle)}</strong> &mdash; ${esc(o.address)} <span style="color:#a63b2e;">(due ${fmtShortDate(o.dueDate)})</span></p>`,
          )
          .join("")}
      </div>`
      : "";

  const stageHtml = data.stages
    .filter((s) => s.rows.length > 0)
    .map((stage) => {
      const rows = stage.rows
        .map(
          (r) => `<tr>
        <td style="padding:6px 10px 6px 0;font-size:13px;color:#1c1917;">${esc(r.address)}${r.city ? `<br/><span style="font-size:11px;color:#a8a29e;">${esc(r.city)}${r.state ? `, ${esc(r.state)}` : ""}</span>` : ""}</td>
        <td style="padding:6px 10px;font-size:13px;color:#57534e;">${esc(r.clientName ?? "—")}</td>
        <td style="padding:6px 10px;font-size:13px;color:#1c1917;text-align:right;white-space:nowrap;">${esc(fmtCents(r.priceCents))}</td>
        <td style="padding:6px 0 6px 10px;font-size:12px;color:#a8a29e;text-align:right;white-space:nowrap;">${r.closeDate ? esc(fmtShortDate(r.closeDate)) : "—"}${r.overdueTasks > 0 ? ` <span style="color:#a63b2e;font-weight:600;">${r.overdueTasks} overdue</span>` : ""}</td>
      </tr>`,
        )
        .join("");
      return `<p style="margin:16px 0 4px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#3c6b4e;border-bottom:1px solid #e7e5e4;padding-bottom:4px;">${esc(stage.label)} &middot; ${stage.rows.length} &middot; ${esc(fmtCents(stage.volumeCents))}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
    })
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:13px;color:#57534e;">${data.fileCount} files across ${data.clientCount} clients.</p>
    ${kpiTable}
    ${overdueHtml}
    ${stageHtml}
  `;

  return renderBrandedEnvelope({
    tenantName: workspaceName,
    subtitle: "Transaction status report",
    accent,
    bodyHtml,
    footerHtml:
      "Sent from <strong>Reports → Transaction status</strong>. Manage or turn off scheduled delivery there.",
  });
}

// ---------- sending ----------

async function sendReportTo(
  tenantId: string,
  recipients: string[],
): Promise<{ sent: number; errors: number }> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { name: true, appearanceConfig: true },
  });
  const data = await buildTransactionStatusReport(tenantId);
  const accent = resolveEmailAccent(parseAppearance(org.appearanceConfig));
  const subject = `Transaction status — ${data.fileCount} files${
    data.overdueTasks > 0 ? `, ${data.overdueTasks} overdue` : ""
  }`;
  const html = transactionStatusReportHtml(data, org.name, accent);
  const text = transactionStatusReportText(data, org.name);

  let sent = 0;
  let errors = 0;
  for (const to of recipients) {
    try {
      await sendTenantEmail({ tenantId, to, subject, body: text, html });
      sent++;
    } catch {
      errors++;
    }
  }
  return { sent, errors };
}

/** Send-now, triggered from the report page. Throws on total failure so the
 *  calling action can show an error. */
export async function sendTransactionReportNow(
  tenantId: string,
  recipients: string[],
): Promise<{ sent: number; errors: number }> {
  if (!emailEnabled()) throw new Error("Email is not configured.");
  return sendReportTo(tenantId, recipients);
}

interface ReportSchedule {
  frequency: "weekly" | "monthly";
  recipients: string[];
  lastSentAt?: string;
}

function parseSchedule(raw: unknown): ReportSchedule | null {
  const s = raw as { transactionReportSchedule?: ReportSchedule } | null;
  const sched = s?.transactionReportSchedule;
  if (!sched || !Array.isArray(sched.recipients) || sched.recipients.length === 0) return null;
  if (sched.frequency !== "weekly" && sched.frequency !== "monthly") return null;
  return sched;
}

export function readTransactionReportSchedule(emailSettings: unknown): ReportSchedule | null {
  return parseSchedule(emailSettings);
}

/** Due today per the chosen cadence, and not already sent since the last
 *  boundary. Weekly = Monday; monthly = the 1st. */
function scheduleDue(schedule: ReportSchedule, now: Date): boolean {
  const last = schedule.lastSentAt ? new Date(schedule.lastSentAt) : null;
  if (schedule.frequency === "weekly") {
    if (now.getDay() !== 1) return false; // Monday
    if (last && now.getTime() - last.getTime() < 6 * 24 * 3600 * 1000) return false;
    return true;
  }
  // monthly
  if (now.getDate() !== 1) return false;
  if (last && last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth()) {
    return false;
  }
  return true;
}

export interface TransactionReportRunSummary {
  workspaces: number;
  sent: number;
  errors: number;
}

/** Nightly cron entry point — see api/cron/nightly/route.ts. */
export async function runTransactionStatusReports(): Promise<TransactionReportRunSummary> {
  const summary: TransactionReportRunSummary = { workspaces: 0, sent: 0, errors: 0 };
  if (!emailEnabled()) return summary;

  const orgs = await prisma.organization.findMany({ select: { id: true, emailSettings: true } });
  const now = new Date();

  for (const org of orgs) {
    const schedule = parseSchedule(org.emailSettings);
    if (!schedule) continue;
    if (!scheduleDue(schedule, now)) continue;
    summary.workspaces++;
    try {
      const result = await sendReportTo(org.id, schedule.recipients);
      summary.sent += result.sent;
      summary.errors += result.errors;
      const current = (org.emailSettings as Record<string, unknown>) ?? {};
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          emailSettings: {
            ...current,
            transactionReportSchedule: { ...schedule, lastSentAt: now.toISOString() },
          },
        },
      });
    } catch {
      summary.errors++;
    }
  }
  return summary;
}
