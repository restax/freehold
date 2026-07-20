/**
 * Per-transaction user pay. The tenant sets a fee on an assignment; the user
 * submits the fees that are due as a pay request; the tenant marks it paid.
 * Freehold records what is owed and prints the statement — money moves however
 * the business already pays people.
 *
 * Whether a fee becomes due at order time or at closing is company policy, so
 * nothing here gates on transaction status: the user submits when it's time.
 */

/** Cents from a "1,250" / "$1,250.00" fee field, or null when blank/invalid. */
export function parseFeeCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** "$1,250.00" — statements and totals always show cents. */
export function fmtCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface PayLine {
  address: string;
  feeCents: number;
}

export function totalCents(lines: Array<{ feeCents: number }>): number {
  return lines.reduce((sum, l) => sum + l.feeCents, 0);
}

/** Plain-text statement — becomes the PDF and the on-screen detail. */
export function statementText(
  lines: PayLine[],
  who: string,
  orgName: string,
  requestedOn: string,
): string {
  const rows = lines.map((l) => `  ${l.address}  —  ${fmtCents(l.feeCents)}`);
  return [
    `${orgName} — payment statement`,
    `For: ${who}`,
    `Requested: ${requestedOn}`,
    "",
    `${lines.length} transaction${lines.length === 1 ? "" : "s"}:`,
    ...rows,
    "",
    `Total: ${fmtCents(totalCents(lines))}`,
  ].join("\n");
}

/** CSV for the same statement, for import into whatever pays people. */
export function statementCsv(lines: PayLine[], who: string): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = lines.map((l) =>
    [esc(l.address), esc(who), (l.feeCents / 100).toFixed(2)].join(","),
  );
  return ["Transaction,Payee,Amount", ...rows].join("\n");
}
