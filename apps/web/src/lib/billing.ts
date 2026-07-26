/**
 * Pure balance math for client billing. Every surface that shows money —
 * the invoices page, a transaction's billing panel, the revenue dashboard,
 * the briefing — computes through here, so no two screens can disagree
 * about what's owed.
 *
 * Ground rules the whole system leans on:
 *  - Ledgers are append-only and signed. A bounced check is a reversal
 *    entry (negative, pointing at the original), never an edit. Balances
 *    are sums, so the arithmetic can't drift from the history.
 *  - invoice.amountCents is a denormalized sum(lines); `invoiceTotalCents`
 *    is the one place that computes it.
 *  - ERPNext-provider invoices carry no Freehold ledger: their ERP is the
 *    record, we mirror status. `displayState` therefore trusts an explicit
 *    PAID status over ledger math.
 */

export interface MoneyLine {
  amountCents: number;
}

/** Sum of line amounts (signed — discounts are negative lines). */
export function invoiceTotalCents(lines: MoneyLine[]): number {
  return lines.reduce((s, l) => s + l.amountCents, 0);
}

/** Sum of ledger entries (signed — reversals are negative). */
export function paidCents(payments: MoneyLine[]): number {
  return payments.reduce((s, p) => s + p.amountCents, 0);
}

export interface InvoiceMoney {
  totalCents: number;
  paidCents: number;
  /** total − paid; negative means overpaid. */
  balanceCents: number;
}

export function invoiceMoney(lines: MoneyLine[], payments: MoneyLine[]): InvoiceMoney {
  const totalCents = invoiceTotalCents(lines);
  const paid = paidCents(payments);
  return { totalCents, paidCents: paid, balanceCents: totalCents - paid };
}

export type InvoiceDisplayState = "draft" | "unpaid" | "partial" | "paid" | "void";

/**
 * What to call an invoice on screen. Lifecycle states (DRAFT/VOID) pass
 * through; an explicit PAID is trusted even without ledger rows (the ERPNext
 * mirror sets PAID with the ledger living in their ERP); otherwise the
 * ledger decides: nothing yet, something, or settled.
 */
export function displayState(
  status: "DRAFT" | "SENT" | "PAID" | "VOID",
  money: InvoiceMoney,
): InvoiceDisplayState {
  if (status === "DRAFT") return "draft";
  if (status === "VOID") return "void";
  if (status === "PAID") return "paid";
  if (money.totalCents > 0 && money.balanceCents <= 0) return "paid";
  if (money.paidCents > 0) return "partial";
  return "unpaid";
}

/** True once the ledger fully covers the total (the moment to flip to PAID). */
export function settlesInvoice(money: InvoiceMoney): boolean {
  return money.totalCents > 0 && money.balanceCents <= 0;
}

/** A client's on-account balance: sum of signed credit entries, floor 0 shown. */
export function creditBalanceCents(entries: MoneyLine[]): number {
  return entries.reduce((s, e) => s + e.amountCents, 0);
}

/**
 * The most credit that may be applied to an invoice right now: no more than
 * the client has on account, no more than the invoice still owes, never
 * negative. Applying is a paired write (credit "applied" − / payment +);
 * this clamp is what keeps both ledgers non-overdrawn.
 */
export function maxCreditApplication(creditBalance: number, invoiceBalance: number): number {
  return Math.max(0, Math.min(creditBalance, invoiceBalance));
}

/** Suggested methods for payment entry; the field also takes free text. */
export const PAYMENT_METHODS = [
  "Check",
  "Wire",
  "ACH",
  "Zelle",
  "Cash",
  "Closing proceeds",
] as const;

/** Line kinds with human labels, for pickers and reporting. */
export const LINE_KINDS = [
  ["service", "Service fee"],
  ["upcharge", "Additional work"],
  ["late_fee", "Late fee"],
  ["deposit", "Deposit"],
  ["adjustment", "Adjustment"],
] as const;
export type LineKind = (typeof LINE_KINDS)[number][0];
