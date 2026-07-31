import type { TenantTx } from "@freehold/db";
import { esc, renderBrandedEnvelope } from "./email-template";
import { fmtCents } from "./pay";
import type { EmailAccent } from "./theme";

/**
 * Payment-agnostic client invoicing. Clients pay by check, Zelle, wire, or
 * out of closing proceeds — Freehold's job is the document, the record, and
 * the follow-up, never the payment rail. "Paid" is whatever the tenant says
 * it is, recorded with a note of how it was settled.
 */

/** Suggested payment terms; the field also takes free text. */
export const TERM_PRESETS = [
  "Due at closing",
  "Due on receipt",
  "Net 15",
  "Net 30",
  "Wire transfer",
  "Check",
] as const;

/** "INV-0001" — per-tenant sequence, padded for sortable filenames. */
export function invoiceLabel(number: number): string {
  return `INV-${String(number).padStart(4, "0")}`;
}

/** Next number in this tenant's sequence; run inside the tenant scope. */
export async function nextInvoiceNumber(tx: TenantTx, tenantId: string): Promise<number> {
  const max = await tx.invoice.aggregate({ where: { tenantId }, _max: { number: true } });
  return (max._max.number ?? 0) + 1;
}

export type AgingBucket = "current" | "overdue";

/**
 * An outstanding invoice is overdue only once its due date has passed; one
 * with no due date on record is simply current — we never invent a deadline
 * the tenant didn't set.
 */
export function agingBucket(dueDate: Date | null, now: Date = new Date()): AgingBucket {
  if (!dueDate) return "current";
  const endOfDay = dueDate.getTime() + 24 * 60 * 60 * 1000;
  return now.getTime() >= endOfDay ? "overdue" : "current";
}

export function daysOverdue(dueDate: Date, now: Date = new Date()): number {
  const endOfDay = dueDate.getTime() + 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((now.getTime() - endOfDay) / (24 * 60 * 60 * 1000)) + 1);
}

export interface InvoicePdfInput {
  number: number;
  workspaceName: string;
  clientName: string | null;
  description: string;
  amountCents: number;
  paymentTerms: string | null;
  dueDate: Date | null;
  issuedOn: Date;
  transactionAddress: string | null;
  /** Itemization; single-line invoices may omit it (description carries it). */
  lines?: Array<{ description: string; amountCents: number }>;
  /** Drafts are watermarked so a not-yet-issued PDF can't pass as a bill. */
  isDraft?: boolean;
  /** Ledger total received; when set, the document shows paid/balance lines. */
  paidCents?: number;
}

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

/** Plain-text invoice body — becomes the PDF and the email text. */
export function invoiceText(inv: InvoicePdfInput): string {
  const lines: string[] = [
    `${invoiceLabel(inv.number)} — ${inv.workspaceName}`,
    `Issued: ${dateOnly(inv.issuedOn)}`,
  ];
  if (inv.isDraft) lines.push("DRAFT — not yet issued");
  if (inv.clientName) lines.push(`Billed to: ${inv.clientName}`);
  if (inv.transactionAddress) lines.push(`Re: ${inv.transactionAddress}`);
  lines.push("");
  if (inv.lines && inv.lines.length > 1) {
    for (const l of inv.lines) {
      lines.push(`  ${l.description}  —  ${fmtCents(l.amountCents)}`);
    }
  } else {
    lines.push(inv.description);
  }
  lines.push("");
  if (inv.paidCents != null && inv.paidCents !== 0) {
    lines.push(`Total: ${fmtCents(inv.amountCents)}`);
    lines.push(`Paid to date: ${fmtCents(inv.paidCents)}`);
    lines.push(`Balance due: ${fmtCents(inv.amountCents - inv.paidCents)}`);
  } else {
    lines.push(`Amount due: ${fmtCents(inv.amountCents)}`);
  }
  if (inv.paymentTerms) lines.push(`Terms: ${inv.paymentTerms}`);
  if (inv.dueDate) lines.push(`Due: ${dateOnly(inv.dueDate)}`);
  return lines.join("\n");
}

export interface OutstandingLine {
  number: number;
  clientName: string | null;
  amountCents: number;
  dueDate: Date | null;
  address: string | null;
}

/** Plain-text outstanding-invoices report, overdue first. */
export function outstandingReportText(
  lines: OutstandingLine[],
  workspaceName: string,
  now: Date = new Date(),
): string {
  const overdue = lines.filter((l) => agingBucket(l.dueDate, now) === "overdue");
  const current = lines.filter((l) => agingBucket(l.dueDate, now) === "current");
  const total = lines.reduce((s, l) => s + l.amountCents, 0);
  const fmt = (l: OutstandingLine) =>
    `  ${invoiceLabel(l.number)}  ${fmtCents(l.amountCents).padStart(12)}  ${
      l.clientName ?? "—"
    }${l.address ? ` · ${l.address}` : ""}${
      l.dueDate
        ? agingBucket(l.dueDate, now) === "overdue"
          ? `  (${daysOverdue(l.dueDate, now)}d overdue)`
          : `  (due ${dateOnly(l.dueDate)})`
        : ""
    }`;

  const out: string[] = [`${workspaceName} — outstanding invoices`, ""];
  if (lines.length === 0) {
    out.push("Nothing outstanding. All invoices are settled.");
    return out.join("\n");
  }
  out.push(
    `${lines.length} outstanding, ${fmtCents(total)} total${
      overdue.length > 0 ? ` — ${overdue.length} overdue` : ""
    }.`,
    "",
  );
  if (overdue.length > 0) {
    out.push("Overdue:");
    for (const l of overdue) out.push(fmt(l));
    out.push("");
  }
  if (current.length > 0) {
    out.push("Current:");
    for (const l of current) out.push(fmt(l));
  }
  return out.join("\n").trimEnd();
}

/**
 * Branded HTML twin of [outstandingReportText] — the report went out as
 * plain text with no styling at all, which read as broken next to every
 * other Freehold email once those picked up the workspace's Appearance
 * colour. Shares `renderBrandedEnvelope` rather than inventing a third copy
 * of the header/footer chrome.
 */
export function outstandingReportHtml(
  lines: OutstandingLine[],
  workspaceName: string,
  accent: EmailAccent,
  now: Date = new Date(),
): string {
  const overdue = lines.filter((l) => agingBucket(l.dueDate, now) === "overdue");
  const current = lines.filter((l) => agingBucket(l.dueDate, now) === "current");
  const total = lines.reduce((s, l) => s + l.amountCents, 0);

  const row = (l: OutstandingLine) => {
    const bucket = agingBucket(l.dueDate, now);
    const when = l.dueDate
      ? bucket === "overdue"
        ? `<span style="color:#b91c1c;font-weight:600;">${daysOverdue(l.dueDate, now)}d overdue</span>`
        : `due ${esc(dateOnly(l.dueDate))}`
      : "";
    return `<tr>
      <td style="padding:6px 10px 6px 0;font-size:13px;color:#1c1917;white-space:nowrap;">${esc(invoiceLabel(l.number))}</td>
      <td style="padding:6px 10px;font-size:13px;color:#1c1917;text-align:right;white-space:nowrap;">${esc(fmtCents(l.amountCents))}</td>
      <td style="padding:6px 10px;font-size:13px;color:#57534e;">${esc(l.clientName ?? "—")}${l.address ? ` <span style="color:#a8a29e;">· ${esc(l.address)}</span>` : ""}</td>
      <td style="padding:6px 0 6px 10px;font-size:12px;text-align:right;white-space:nowrap;">${when}</td>
    </tr>`;
  };

  const table = (rows: OutstandingLine[]) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 14px;">${rows.map(row).join("")}</table>`;

  const bodyHtml =
    lines.length === 0
      ? `<p style="margin:0;font-size:14px;color:#57534e;">Nothing outstanding. All invoices are settled.</p>`
      : `<p style="margin:0 0 12px;font-size:14px;color:#1c1917;">${lines.length} outstanding, <strong>${esc(fmtCents(total))}</strong> total${overdue.length > 0 ? `, <strong style="color:#b91c1c;">${overdue.length} overdue</strong>` : ""}.</p>
      ${overdue.length > 0 ? `<p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#a8a29e;">Overdue</p>${table(overdue)}` : ""}
      ${current.length > 0 ? `<p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#a8a29e;">Current</p>${table(current)}` : ""}`;

  return renderBrandedEnvelope({
    tenantName: workspaceName,
    subtitle: "Outstanding invoices",
    accent,
    bodyHtml,
    footerHtml: `Sent to the recipient set for ${esc(workspaceName)} in <strong>Settings → Invoice report</strong>. Mornings with nothing outstanding send nothing.`,
  });
}
