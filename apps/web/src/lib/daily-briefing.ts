import { prisma, withTenant } from "@freehold/db";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import { fmtDate, ROLE_LABEL, STATUS_LABEL } from "@/lib/format";
import { renderTemplatePdf } from "@/lib/templates";

/**
 * Daily briefing: every morning, each opted-in workspace gets an executive
 * summary of its active transactions — status, key dates, and the contact
 * details for every party — emailed to the owner and admins, with a PDF
 * attached. The point is resilience: once it's in your inbox it's yours,
 * readable offline, no matter what happens to Freehold, your storage, or your
 * connection. Opt in with organization.emailSettings.dailyBriefing.
 */

interface BriefingParty {
  role: string;
  name: string;
  email: string | null;
  phone: string | null;
}
interface BriefingTxn {
  address: string;
  status: string;
  closeDate: Date | null;
  nextDeadline: { title: string; due: Date | null } | null;
  parties: BriefingParty[];
}

async function briefingTransactions(tenantId: string): Promise<BriefingTxn[]> {
  const rows = await withTenant(tenantId, (tx) =>
    tx.transaction.findMany({
      where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
      orderBy: [{ closeDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      include: {
        parties: { include: { contact: { select: { name: true, email: true, phone: true } } } },
        tasks: {
          where: { status: "OPEN" },
          orderBy: { dueDate: { sort: "asc", nulls: "last" } },
          take: 1,
        },
      },
    }),
  );
  return rows.map((t) => ({
    address: t.propertyAddress,
    status: STATUS_LABEL[t.status] ?? t.status,
    closeDate: t.closeDate,
    nextDeadline: t.tasks[0] ? { title: t.tasks[0].title, due: t.tasks[0].dueDate } : null,
    parties: t.parties.map((p) => ({
      role: ROLE_LABEL[p.role] ?? p.role,
      name: p.contact.name,
      email: p.contact.email,
      phone: p.contact.phone,
    })),
  }));
}

interface LicenseAlert {
  who: string;
  state: string;
  expiresAt: Date;
  expired: boolean;
}

/** Licenses expired or inside the 60-day warning window, for the briefing. */
async function briefingLicenseAlerts(tenantId: string): Promise<LicenseAlert[]> {
  const rows = await withTenant(tenantId, (tx) =>
    tx.userLicense.findMany({
      where: { expiresAt: { lte: new Date(Date.now() + 60 * 24 * 3600 * 1000) } },
      orderBy: { expiresAt: "asc" },
      select: { state: true, expiresAt: true, user: { select: { name: true } } },
    }),
  );
  const now = new Date();
  return rows.flatMap((r) =>
    r.expiresAt
      ? [{ who: r.user.name, state: r.state, expiresAt: r.expiresAt, expired: r.expiresAt < now }]
      : [],
  );
}

const alertLine = (a: LicenseAlert) =>
  `${a.who} — ${a.state} license ${a.expired ? "EXPIRED" : "expires"} ${fmtDate(a.expiresAt)}`;

/** Plain-text executive summary — becomes the PDF and the email text fallback. */
function briefingText(
  txns: BriefingTxn[],
  orgName: string,
  dateLabel: string,
  alerts: LicenseAlert[] = [],
): string {
  const lines: string[] = [`${orgName} — active transactions as of ${dateLabel}`, ""];
  if (alerts.length > 0) {
    lines.push("License alerts:");
    for (const a of alerts) lines.push(`  ${alertLine(a)}`);
    lines.push("");
  }
  if (txns.length === 0) {
    lines.push("No active transactions today.");
    return lines.join("\n");
  }
  lines.push(`${txns.length} active transaction${txns.length === 1 ? "" : "s"}.`, "");
  for (const t of txns) {
    lines.push(t.address);
    lines.push(`  Status: ${t.status}${t.closeDate ? `   Closing: ${fmtDate(t.closeDate)}` : ""}`);
    if (t.nextDeadline) {
      lines.push(
        `  Next: ${t.nextDeadline.title}${
          t.nextDeadline.due ? ` (due ${fmtDate(t.nextDeadline.due)})` : ""
        }`,
      );
    }
    for (const p of t.parties) {
      const contact = [p.email, p.phone].filter(Boolean).join(" · ");
      lines.push(`  ${p.role}: ${p.name}${contact ? ` — ${contact}` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** Branded HTML so the summary is readable inline, not only in the attachment. */
function briefingHtml(
  txns: BriefingTxn[],
  orgName: string,
  dateLabel: string,
  alerts: LicenseAlert[] = [],
): string {
  const alertBlock = alerts.length
    ? `<div style="border:1px solid #fcd34d;background:#fffbeb;border-radius:10px;padding:10px 14px;margin:0 0 12px;">
        <p style="margin:0;font-weight:600;font-size:13px;color:#92400e;">License alerts</p>
        ${alerts
          .map(
            (a) =>
              `<p style="margin:4px 0 0;font-size:13px;color:#78350f;">${esc(alertLine(a))}</p>`,
          )
          .join("")}
      </div>`
    : "";
  const cards = txns.length
    ? txns
        .map((t) => {
          const meta = [t.status, t.closeDate ? `Closing ${fmtDate(t.closeDate)}` : null]
            .filter(Boolean)
            .join(" &nbsp;·&nbsp; ");
          const next = t.nextDeadline
            ? `<p style="margin:4px 0 0;color:#57534e;font-size:13px;">Next: ${esc(
                t.nextDeadline.title,
              )}${t.nextDeadline.due ? ` (due ${fmtDate(t.nextDeadline.due)})` : ""}</p>`
            : "";
          const parties = t.parties
            .map((p) => {
              const contact = [p.email, p.phone]
                .filter((x): x is string => Boolean(x))
                .map(esc)
                .join(" &nbsp;·&nbsp; ");
              return `<tr><td style="padding:2px 8px 2px 0;color:#78716c;font-size:12px;white-space:nowrap;">${esc(
                p.role,
              )}</td><td style="padding:2px 0;font-size:13px;">${esc(p.name)}${
                contact ? ` <span style="color:#78716c;">— ${contact}</span>` : ""
              }</td></tr>`;
            })
            .join("");
          return `<div style="border:1px solid #e7e5e4;border-radius:10px;padding:14px 16px;margin:0 0 12px;">
            <p style="margin:0;font-weight:600;font-size:15px;">${esc(t.address)}</p>
            <p style="margin:2px 0 0;color:#57534e;font-size:13px;">${meta}</p>${next}
            ${parties ? `<table style="margin-top:8px;border-collapse:collapse;">${parties}</table>` : ""}
          </div>`;
        })
        .join("")
    : `<p style="color:#57534e;">No active transactions today.</p>`;

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1c1917;">
    <div style="background:#15803d;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-weight:700;">${esc(orgName)} — Daily briefing</p>
      <p style="margin:2px 0 0;font-size:13px;opacity:.9;">Active transactions as of ${dateLabel}</p>
    </div>
    <div style="padding:18px 20px;background:#fafaf9;border:1px solid #e7e5e4;border-top:0;border-radius:0 0 12px 12px;">
      ${alertBlock}
      ${cards}
      <p style="margin:14px 0 0;color:#a8a29e;font-size:12px;">A full copy is attached as a PDF. Keep this email — it's readable offline, whatever happens to your connection or ours. Powered by Freehold.</p>
    </div>
  </div>`;
}

async function recipients(tenantId: string): Promise<string[]> {
  const members = await prisma.member.findMany({
    where: { organizationId: tenantId, role: { in: ["owner", "admin"] } },
    select: { user: { select: { email: true } } },
  });
  return [...new Set(members.map((m) => m.user.email).filter(Boolean))];
}

export interface BriefingRunSummary {
  workspaces: number;
  sent: number;
  errors: number;
}

export async function runDailyBriefings(): Promise<BriefingRunSummary> {
  const summary: BriefingRunSummary = { workspaces: 0, sent: 0, errors: 0 };
  if (!emailEnabled()) return summary;

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, emailSettings: true },
  });
  const optedIn = orgs.filter(
    (o) => (o.emailSettings as { dailyBriefing?: boolean } | null)?.dailyBriefing === true,
  );
  summary.workspaces = optedIn.length;

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  for (const org of optedIn) {
    try {
      const txns = await briefingTransactions(org.id);
      const alerts = await briefingLicenseAlerts(org.id);
      const text = briefingText(txns, org.name, dateLabel, alerts);
      const html = briefingHtml(txns, org.name, dateLabel, alerts);
      const pdf = await renderTemplatePdf(`${org.name} — Daily briefing (${dateLabel})`, text);
      const to = await recipients(org.id);
      for (const addr of to) {
        await sendTenantEmail({
          tenantId: org.id,
          to: addr,
          subject: `Daily briefing — ${txns.length} active transaction${txns.length === 1 ? "" : "s"}`,
          body: text,
          html,
          attachments: [
            {
              filename: `daily-briefing-${new Date().toISOString().slice(0, 10)}.pdf`,
              content: pdf.toString("base64"),
            },
          ],
        }).then(
          () => {
            summary.sent += 1;
          },
          () => {
            summary.errors += 1;
          },
        );
      }
    } catch {
      summary.errors += 1;
    }
  }
  return summary;
}
