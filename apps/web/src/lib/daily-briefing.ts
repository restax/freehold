import { prisma, withTenant } from "@freehold/db";
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import { transactionAlerts } from "@/lib/alerts";
import { hexToRgb } from "@/lib/color";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import { renderBrandedEnvelope } from "@/lib/email-template";
import { fmtDate, ROLE_LABEL, STATUS_LABEL } from "@/lib/format";
import { type EmailAccent, parseAppearance, resolveEmailAccent } from "@/lib/theme";
import { type Staleness, stalenessMessage } from "@/lib/transaction-alerts";

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
  /** Who last worked the file and what they did; null = never touched. */
  lastActivity: { at: Date; actorName: string; summary: string } | null;
  staleness: Staleness | null;
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
  // Same helper the dashboard and transaction page use, so the briefing can
  // never disagree with the app about whether a file is flagged.
  const alerts = new Map((await transactionAlerts(tenantId)).map((a) => [a.id, a]));
  return rows.map((t) => {
    const alert = alerts.get(t.id);
    return {
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
      lastActivity: alert?.lastActivity ?? null,
      staleness: alert?.staleness ?? null,
    };
  });
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
    lines.push(
      t.lastActivity
        ? `  Last touched: ${fmtDate(t.lastActivity.at)} by ${t.lastActivity.actorName} — ${t.lastActivity.summary}`
        : "  Last touched: no activity recorded yet",
    );
    if (t.staleness?.stale) lines.push(`  ** ${stalenessMessage(t.staleness)}`);
    lines.push("");
  }
  return lines.join("\n");
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/**
 * Branded HTML so the summary is readable inline, not only in the
 * attachment. Shares its header/footer chrome with every other Freehold
 * email via `renderBrandedEnvelope`, themed with the workspace's own
 * Appearance accent rather than a hardcoded colour — so this reads as the
 * same product, in the same colour, as every other Freehold email rather
 * than a one-off. Carries its own explainer + footer, since — unlike a
 * transaction email a TC chose to send — this one goes out automatically,
 * so the recipient needs to know what it is and how to stop it without
 * asking anyone.
 */
function briefingHtml(
  txns: BriefingTxn[],
  orgName: string,
  dateLabel: string,
  accent: EmailAccent,
  alerts: LicenseAlert[] = [],
): string {
  const alertBlock = alerts.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;"><tr><td style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;">
        <p style="margin:0;font-weight:600;font-size:13px;color:#92400e;">License alerts</p>
        ${alerts
          .map(
            (a) =>
              `<p style="margin:4px 0 0;font-size:13px;color:#78350f;">${esc(alertLine(a))}</p>`,
          )
          .join("")}
      </td></tr></table>`
    : "";
  const cards = txns.length
    ? txns
        .map((t) => {
          const meta = [t.status, t.closeDate ? `Closing ${fmtDate(t.closeDate)}` : null]
            .filter(Boolean)
            .join(" &nbsp;·&nbsp; ");
          const next = t.nextDeadline
            ? `<p style="margin:3px 0 0;color:#57534e;font-size:13px;">Next: ${esc(
                t.nextDeadline.title,
              )}${t.nextDeadline.due ? ` (due ${fmtDate(t.nextDeadline.due)})` : ""}</p>`
            : "";
          const parties = t.parties
            .map((p) => {
              const contact = [p.email, p.phone]
                .filter((x): x is string => Boolean(x))
                .map(esc)
                .join(" &nbsp;·&nbsp; ");
              return `<tr><td style="padding:1px 8px 1px 0;color:#78716c;font-size:11px;white-space:nowrap;">${esc(
                p.role,
              )}</td><td style="padding:1px 0;font-size:12px;">${esc(p.name)}${
                contact ? ` <span style="color:#78716c;">— ${contact}</span>` : ""
              }</td></tr>`;
            })
            .join("");
          // Shaded last-touched strip: amber when the file is flagged, plain
          // stone otherwise. Table + inline styles so it survives every client.
          const flagged = Boolean(t.staleness?.stale);
          const touched = t.lastActivity
            ? `<strong>${fmtDate(t.lastActivity.at)}</strong> by ${esc(
                t.lastActivity.actorName,
              )} — ${esc(t.lastActivity.summary)}`
            : "No activity recorded yet";
          const flagLine =
            t.staleness && flagged
              ? `<p style="margin:3px 0 0;font-size:11px;font-weight:600;color:#92400e;">⚠ ${esc(
                  stalenessMessage(t.staleness),
                )}</p>`
              : "";
          const activityStrip = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;"><tr><td style="background:${
            flagged ? "#fffbeb" : "#fafaf9"
          };border:1px solid ${
            flagged ? "#fcd34d" : "#e7e5e4"
          };border-radius:6px;padding:7px 10px;">
            <p style="margin:0;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a29e;">Last touched</p>
            <p style="margin:1px 0 0;font-size:12px;color:#44403c;">${touched}</p>${flagLine}
          </td></tr></table>`;
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;"><tr><td style="border:1px solid ${
            flagged ? "#fcd34d" : "#e7e5e4"
          };border-radius:8px;padding:12px 14px;">
            <p style="margin:0;font-weight:600;font-size:14px;">${esc(t.address)}</p>
            <p style="margin:2px 0 0;color:#57534e;font-size:12px;">${meta}</p>${next}
            ${parties ? `<table style="margin-top:6px;border-collapse:collapse;">${parties}</table>` : ""}
            ${activityStrip}
          </td></tr></table>`;
        })
        .join("")
    : `<p style="color:#57534e;font-size:13px;">No active transactions today.</p>`;

  return renderBrandedEnvelope({
    tenantName: orgName,
    subtitle: `Daily transaction briefing · ${dateLabel}`,
    accent,
    width: 640,
    explainerHtml: `Automatic morning summary of every active transaction in ${esc(orgName)}, sent to workspace
        owners and admins so no file lives in only one inbox. A full copy is attached as a PDF —
        keep it; it's readable offline no matter what happens to your connection or ours.`,
    bodyHtml: `${alertBlock}${cards}`,
    footerHtml: `<strong>Why am I getting this?</strong> You're an owner or admin on ${esc(orgName)}'s Freehold
        workspace. Concerns about a transaction on this list? Reply to this email, or reach a workspace
        admin directly. To stop these emails, an admin can turn it off from
        <strong>Settings → Daily briefing</strong>.`,
  });
}

const PAGE: [number, number] = [612, 792];
const MARGIN = 50;
const HEADER_H = 92;
const CONT_HEADER_H = 34;
const FOOTER_H = 46;
/** pdf-lib wants 0–1 components; the theme system deals in hex everywhere else. */
const rgbHex = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return rgb(r / 255, g / 255, b / 255);
};
const AMBER_BG = rgb(1, 0xfb / 255, 0xeb / 255);
const AMBER_LINE = rgb(0xfc / 255, 0xd3 / 255, 0x4d / 255);
const AMBER_TEXT = rgb(0x78 / 255, 0x35 / 255, 0x0f / 255);
const STONE_900 = rgb(0x1c / 255, 0x19 / 255, 0x17 / 255);
const STONE_600 = rgb(0x57 / 255, 0x53 / 255, 0x4e / 255);
const STONE_400 = rgb(0xa8 / 255, 0xa2 / 255, 0x9e / 255);
const STONE_BORDER = rgb(0xe7 / 255, 0xe5 / 255, 0xe4 / 255);
const WHITE = rgb(1, 1, 1);

/**
 * The PDF attachment, purpose-built for the briefing rather than the plain
 * merge-letter renderer (`templates.ts` → `renderTemplatePdf`) — this one
 * gets a branded header, an explainer of what the document is and why the
 * recipient has it, denser bordered transaction cards instead of a raw text
 * dump, and a page footer with the same explanation, since the PDF is what
 * survives once it's saved to disk long after the email is gone.
 */
async function renderBriefingPdf(
  txns: BriefingTxn[],
  orgName: string,
  dateLabel: string,
  accent: EmailAccent,
  alerts: LicenseAlert[],
): Promise<Buffer> {
  const headerColor = rgbHex(accent.header);
  const headerFgColor = rgbHex(accent.headerFg);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE[0] - MARGIN * 2;

  const wrap = (line: string, f: PDFFont, size: number, width = maxWidth): string[] => {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [""];
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const probe = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(probe, size) > width && cur) {
        out.push(cur);
        cur = w;
      } else {
        cur = probe;
      }
    }
    if (cur) out.push(cur);
    return out;
  };

  let page: PDFPage = doc.addPage(PAGE);
  let y = PAGE[1];

  const drawFirstHeader = () => {
    page.drawRectangle({
      x: 0,
      y: PAGE[1] - HEADER_H,
      width: PAGE[0],
      height: HEADER_H,
      color: headerColor,
    });
    page.drawText(orgName.slice(0, 60), {
      x: MARGIN,
      y: PAGE[1] - 38,
      size: 18,
      font: bold,
      color: headerFgColor,
    });
    page.drawText(`Daily transaction briefing  ·  ${dateLabel}`, {
      x: MARGIN,
      y: PAGE[1] - 58,
      size: 11,
      font,
      color: headerFgColor,
      opacity: 0.85,
    });
    y = PAGE[1] - HEADER_H - 20;

    const explainer =
      `Automatic morning summary of every active transaction in ${orgName}, sent to workspace ` +
      "owners and admins so no file lives in only one inbox. Keep this PDF — it's a permanent, " +
      "offline record no matter what happens to your connection, your storage, or Freehold.";
    for (const seg of wrap(explainer, font, 9.5)) {
      page.drawText(seg, { x: MARGIN, y, size: 9.5, font, color: STONE_600 });
      y -= 13;
    }
    y -= 10;
  };

  const drawContinuationHeader = () => {
    page.drawRectangle({
      x: 0,
      y: PAGE[1] - CONT_HEADER_H,
      width: PAGE[0],
      height: CONT_HEADER_H,
      color: STONE_BORDER,
    });
    page.drawText(`${orgName} — Daily briefing (continued)`, {
      x: MARGIN,
      y: PAGE[1] - 22,
      size: 9,
      font: bold,
      color: STONE_600,
    });
    y = PAGE[1] - CONT_HEADER_H - 20;
  };

  const newPage = () => {
    page = doc.addPage(PAGE);
    drawContinuationHeader();
  };

  const ensureRoom = (needed: number) => {
    if (y < MARGIN + FOOTER_H + needed) newPage();
  };

  drawFirstHeader();

  if (alerts.length > 0) {
    ensureRoom(20 + alerts.length * 13);
    const boxTop = y;
    const lines: string[] = ["License alerts", ...alerts.map(alertLine)];
    let by = y - 14;
    for (let i = 1; i < lines.length; i++) by -= 13;
    const boxHeight = boxTop - by + 10;
    page.drawRectangle({
      x: MARGIN,
      y: boxTop - boxHeight + 4,
      width: maxWidth,
      height: boxHeight,
      color: AMBER_BG,
      borderColor: AMBER_LINE,
      borderWidth: 1,
    });
    let ay = y - 4;
    page.drawText(lines[0], { x: MARGIN + 10, y: ay, size: 10, font: bold, color: AMBER_TEXT });
    ay -= 15;
    for (const line of lines.slice(1)) {
      page.drawText(line, { x: MARGIN + 10, y: ay, size: 9.5, font, color: AMBER_TEXT });
      ay -= 13;
    }
    y = ay - 6;
  }

  if (txns.length === 0) {
    page.drawText("No active transactions today.", {
      x: MARGIN,
      y,
      size: 11,
      font,
      color: STONE_600,
    });
    y -= 16;
  }

  for (const t of txns) {
    const partyLines = t.parties.map((p) => {
      const contact = [p.email, p.phone].filter(Boolean).join("  ·  ");
      return `${p.role}:  ${p.name}${contact ? `  —  ${contact}` : ""}`;
    });
    const metaLine = [t.status, t.closeDate ? `Closing ${fmtDate(t.closeDate)}` : null]
      .filter(Boolean)
      .join("   ·   ");
    const nextLine = t.nextDeadline
      ? `Next: ${t.nextDeadline.title}${t.nextDeadline.due ? ` (due ${fmtDate(t.nextDeadline.due)})` : ""}`
      : null;

    // Shaded last-touched strip at the foot of each card. Two lines when the
    // file is flagged (the reason gets its own line), one when it isn't.
    const flagged = Boolean(t.staleness?.stale);
    const touchedLine = t.lastActivity
      ? `${fmtDate(t.lastActivity.at)} by ${t.lastActivity.actorName} — ${t.lastActivity.summary}`
      : "No activity recorded yet";
    const flagLine = t.staleness && flagged ? stalenessMessage(t.staleness) : null;
    const stripHeight = 16 + (flagLine ? 22 : 11);

    const bodyLines = 1 + (nextLine ? 1 : 0) + partyLines.length;
    const cardHeight = 26 + bodyLines * 13 + stripHeight + 6;
    ensureRoom(cardHeight + 8);

    const cardTop = y;
    page.drawRectangle({
      x: MARGIN,
      y: cardTop - cardHeight,
      width: maxWidth,
      height: cardHeight,
      color: WHITE,
      borderColor: flagged ? AMBER_LINE : STONE_BORDER,
      borderWidth: 1,
    });

    let cy = cardTop - 16;
    page.drawText(t.address.slice(0, 90), {
      x: MARGIN + 10,
      y: cy,
      size: 12,
      font: bold,
      color: STONE_900,
    });
    cy -= 15;
    page.drawText(metaLine, { x: MARGIN + 10, y: cy, size: 9.5, font, color: STONE_600 });
    cy -= 13;
    if (nextLine) {
      page.drawText(nextLine, { x: MARGIN + 10, y: cy, size: 9.5, font, color: STONE_600 });
      cy -= 13;
    }
    for (const line of partyLines) {
      page.drawText(line.slice(0, 100), { x: MARGIN + 10, y: cy, size: 9, font, color: STONE_600 });
      cy -= 13;
    }

    const stripTop = cardTop - cardHeight + stripHeight + 4;
    page.drawRectangle({
      x: MARGIN + 6,
      y: stripTop - stripHeight,
      width: maxWidth - 12,
      height: stripHeight,
      color: flagged ? AMBER_BG : rgb(0xfa / 255, 0xfa / 255, 0xf9 / 255),
      borderColor: flagged ? AMBER_LINE : STONE_BORDER,
      borderWidth: 0.5,
    });
    let sy = stripTop - 10;
    page.drawText("LAST TOUCHED", { x: MARGIN + 14, y: sy, size: 6.5, font, color: STONE_400 });
    sy -= 10;
    for (const seg of wrap(touchedLine, font, 8.5, maxWidth - 30).slice(0, 1)) {
      page.drawText(seg, { x: MARGIN + 14, y: sy, size: 8.5, font, color: STONE_600 });
    }
    if (flagLine) {
      sy -= 11;
      page.drawText(flagLine.slice(0, 110), {
        x: MARGIN + 14,
        y: sy,
        size: 8.5,
        font: bold,
        color: AMBER_TEXT,
      });
    }

    y = cardTop - cardHeight - 8;
  }

  const pages = doc.getPages();
  const footerLines = wrap(
    "Sent automatically to workspace owners and admins. Concerns? Reply to the briefing email, " +
      "or a workspace admin can turn this off from Settings -> Daily briefing.",
    font,
    7.5,
  );
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: MARGIN, y: FOOTER_H - 8 },
      end: { x: PAGE[0] - MARGIN, y: FOOTER_H - 8 },
      thickness: 0.5,
      color: STONE_BORDER,
    });
    let fy = FOOTER_H - 20;
    for (const line of footerLines) {
      p.drawText(line, { x: MARGIN, y: fy, size: 7.5, font, color: STONE_400 });
      fy -= 10;
    }
    const pageNum = `Freehold  ·  Page ${i + 1} of ${pages.length}`;
    p.drawText(pageNum, {
      x: PAGE[0] - MARGIN - font.widthOfTextAtSize(pageNum, 7.5),
      y: 8,
      size: 7.5,
      font,
      color: STONE_400,
    });
  });

  return Buffer.from(await doc.save());
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
    select: { id: true, name: true, emailSettings: true, appearanceConfig: true },
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
      const accent = resolveEmailAccent(parseAppearance(org.appearanceConfig));
      const txns = await briefingTransactions(org.id);
      const alerts = await briefingLicenseAlerts(org.id);
      const text = briefingText(txns, org.name, dateLabel, alerts);
      const html = briefingHtml(txns, org.name, dateLabel, accent, alerts);
      const pdf = await renderBriefingPdf(txns, org.name, dateLabel, accent, alerts);
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
