/**
 * How a workspace bills, and how any one client differs. Every TC runs money
 * differently — deposit up front, invoice at closing, one consolidated bill a
 * month — so the policy is a workspace default (Organization.billingDefaults)
 * with per-client overrides (Client.billingConfig), resolved here exactly
 * like alert thresholds are: unset keys fall back, malformed values fall
 * back, and rendering a page can never throw because one client's JSON is
 * odd.
 *
 * The policy *describes* how billing should happen; the stages that act on it
 * (auto-drafts at file entry/closing, scheduled consolidated invoices, late
 * fee suggestions) all read it from here so behavior can't drift by surface.
 */

export type BillingMode =
  | "per_file_close"
  | "per_file_entry"
  | "upfront_full"
  | "upfront_deposit"
  | "monthly"
  | "weekly";

export const BILLING_MODES: Array<{ key: BillingMode; label: string; blurb: string }> = [
  {
    key: "per_file_close",
    label: "Invoice each file at closing",
    blurb:
      "A draft is prepared when the file closes; issue it before closing to collect at the table.",
  },
  {
    key: "per_file_entry",
    label: "Invoice each file at entry",
    blurb: "A draft is prepared the moment the file is opened.",
  },
  {
    key: "upfront_full",
    label: "Payment in full up front",
    blurb: "The whole fee is drafted when the file is opened.",
  },
  {
    key: "upfront_deposit",
    label: "Deposit up front, balance later",
    blurb: "A deposit invoice at entry, the remainder when the file closes.",
  },
  {
    key: "monthly",
    label: "Consolidated monthly invoice",
    blurb: "All the month's unbilled files roll into one reviewed draft.",
  },
  {
    key: "weekly",
    label: "Consolidated weekly invoice",
    blurb: "All the week's unbilled files roll into one reviewed draft.",
  },
];

export const BILLING_MODE_LABEL: Record<BillingMode, string> = Object.fromEntries(
  BILLING_MODES.map((m) => [m.key, m.label]),
) as Record<BillingMode, string>;

export interface LateFeePolicy {
  enabled: boolean;
  type: "flat" | "percent";
  /** Used when type is "flat". */
  flatCents: number;
  /** Used when type is "percent" — percent of the invoice total, e.g. 1.5. */
  percent: number;
  /** Days past due before a late fee is suggested. */
  graceDays: number;
}

export interface BillingPolicy {
  mode: BillingMode;
  /** Percent of the expected fee invoiced up front under upfront_deposit. */
  depositPercent: number;
  lateFee: LateFeePolicy;
  /** Workspace-wide standard fee per file; a client's defaultFeeCents beats it. */
  defaultFeeCents: number | null;
}

export const DEFAULT_BILLING_POLICY: BillingPolicy = {
  mode: "per_file_close",
  depositPercent: 50,
  lateFee: { enabled: false, type: "flat", flatCents: 2500, percent: 1.5, graceDays: 5 },
  defaultFeeCents: null,
};

const isMode = (v: unknown): v is BillingMode => BILLING_MODES.some((m) => m.key === v);

function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function mergeLateFee(base: LateFeePolicy, raw: unknown): LateFeePolicy {
  if (raw == null || typeof raw !== "object") return base;
  const c = raw as Partial<Record<keyof LateFeePolicy, unknown>>;
  return {
    enabled: typeof c.enabled === "boolean" ? c.enabled : base.enabled,
    type: c.type === "flat" || c.type === "percent" ? c.type : base.type,
    flatCents: Math.round(num(c.flatCents, 0, 1_000_000, base.flatCents)),
    percent: num(c.percent, 0, 100, base.percent),
    graceDays: Math.round(num(c.graceDays, 0, 365, base.graceDays)),
  };
}

function mergePolicy(base: BillingPolicy, raw: unknown): BillingPolicy {
  if (raw == null || typeof raw !== "object") return base;
  const c = raw as Partial<Record<keyof BillingPolicy, unknown>>;
  return {
    mode: isMode(c.mode) ? c.mode : base.mode,
    depositPercent: Math.round(num(c.depositPercent, 1, 100, base.depositPercent)),
    lateFee: mergeLateFee(base.lateFee, c.lateFee),
    defaultFeeCents:
      typeof c.defaultFeeCents === "number" && Number.isFinite(c.defaultFeeCents)
        ? Math.max(0, Math.round(c.defaultFeeCents))
        : base.defaultFeeCents,
  };
}

/** Workspace policy from the stored JSON (defaults where unset/malformed). */
export function tenantBillingPolicy(raw: unknown): BillingPolicy {
  return mergePolicy(DEFAULT_BILLING_POLICY, raw);
}

/** One client's effective policy: their overrides on top of the workspace's. */
export function clientBillingPolicy(tenantRaw: unknown, clientRaw: unknown): BillingPolicy {
  return mergePolicy(tenantBillingPolicy(tenantRaw), clientRaw);
}

/** The late fee a policy would add to an invoice of this size, in cents. */
export function lateFeeCents(lf: LateFeePolicy, invoiceTotalCents: number): number {
  if (!lf.enabled) return 0;
  return lf.type === "flat"
    ? lf.flatCents
    : Math.max(0, Math.round((invoiceTotalCents * lf.percent) / 100));
}

/**
 * Whether to *suggest* a late fee: policy on, invoice overdue past the grace
 * period, and no late fee already on it (one per invoice — predictable beats
 * compounding). Suggestion only; a person clicks to add it, always.
 */
export function lateFeeEligible(
  lf: LateFeePolicy,
  dueDate: Date | null,
  daysPastDue: number,
  hasLateFeeLine: boolean,
): boolean {
  if (!lf.enabled || !dueDate || hasLateFeeLine) return false;
  return daysPastDue > lf.graceDays;
}

/**
 * The fee a new file should expect: the client's own default, else the
 * workspace default, else nothing (the file shows "fee not set" until the TC
 * decides).
 */
export function resolveDefaultFee(
  clientDefaultFeeCents: number | null | undefined,
  policy: BillingPolicy,
): number | null {
  return clientDefaultFeeCents ?? policy.defaultFeeCents;
}
