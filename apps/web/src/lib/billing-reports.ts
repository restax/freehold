/**
 * Report math for the money pages: A/R aging, monthly collections, and the
 * CSV shapes accounting software imports. Dependency-free on purpose (the
 * billing-cadence pattern) so every figure that reaches an accountant is
 * unit-tested.
 */

export const AGING_BUCKETS = ["Current", "1–30", "31–60", "61–90", "90+"] as const;
export type AgingBucketName = (typeof AGING_BUCKETS)[number];

export interface AgingInput {
  balanceCents: number;
  /** Days past due; 0 or less (or no due date) is Current. */
  daysPastDue: number;
}

/** Outstanding balances distributed into the standard A/R aging buckets. */
export function agingReport(rows: AgingInput[]): Record<AgingBucketName, number> {
  const out: Record<AgingBucketName, number> = {
    Current: 0,
    "1–30": 0,
    "31–60": 0,
    "61–90": 0,
    "90+": 0,
  };
  for (const r of rows) {
    if (r.balanceCents <= 0) continue;
    const bucket: AgingBucketName =
      r.daysPastDue <= 0
        ? "Current"
        : r.daysPastDue <= 30
          ? "1–30"
          : r.daysPastDue <= 60
            ? "31–60"
            : r.daysPastDue <= 90
              ? "61–90"
              : "90+";
    out[bucket] += r.balanceCents;
  }
  return out;
}

export interface CollectedInput {
  amountCents: number;
  receivedAt: Date;
}

/**
 * Collections by calendar month, newest first, covering the last `months`
 * months (empty months included, so a slow month is visible as a low bar,
 * not a missing row). Reversals are negative entries and net out naturally.
 */
export function monthlyCollected(
  payments: CollectedInput[],
  months: number,
  now: Date = new Date(),
): Array<{ month: string; cents: number }> {
  const keys: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const sums = new Map(keys.map((k) => [k, 0]));
  for (const p of payments) {
    const k = `${p.receivedAt.getFullYear()}-${String(p.receivedAt.getMonth() + 1).padStart(2, "0")}`;
    if (sums.has(k)) sums.set(k, (sums.get(k) ?? 0) + p.amountCents);
  }
  return keys.map((month) => ({ month, cents: sums.get(month) ?? 0 }));
}

// ---------- CSV ----------

/** RFC-4180 escaping: quote when needed, double internal quotes. */
export function csvField(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Array<Array<string | number | null>>): string {
  return [header, ...rows].map((r) => r.map(csvField).join(",")).join("\r\n");
}

export const dollars = (cents: number) => (cents / 100).toFixed(2);
