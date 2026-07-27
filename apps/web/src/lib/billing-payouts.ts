/**
 * Staff payout math. A teammate on a file is paid either a flat amount or a
 * percentage of the file's fee revenue — and for percentages, two figures
 * matter: what they've *earned* (their share of what's billed) and what's
 * *payable now* (their share of what's actually collected). The TC promises
 * the first and owes the second; pay requests freeze the payable figure at
 * request time. Dependency-free (the billing-cadence pattern) so every cent
 * that reaches a paycheck is unit-tested.
 */

export interface PayoutBasis {
  feeCents: number | null;
  /** Basis points: 7000 = 70%. Exactly one of the two fields is set. */
  feePercentBp: number | null;
}

/** The payout a basis yields against a revenue figure. Flat ignores revenue. */
export function payoutCents(basis: PayoutBasis, revenueCents: number): number {
  if (basis.feeCents != null) return basis.feeCents;
  if (basis.feePercentBp != null) {
    return Math.max(0, Math.round((revenueCents * basis.feePercentBp) / 10000));
  }
  return 0;
}

export interface AssigneePayout {
  /** Share of what's billed — the promise. */
  earnedCents: number;
  /** Share of what's collected — what could be paid today. */
  payableCents: number;
}

export function assigneePayout(
  basis: PayoutBasis,
  billedCents: number,
  collectedCents: number,
): AssigneePayout {
  return {
    earnedCents: payoutCents(basis, billedCents),
    payableCents: payoutCents(basis, collectedCents),
  };
}

export interface FilePayoutTotals {
  earnedCents: number;
  payableCents: number;
  /** Billed minus earned payouts — the file's margin as promised. */
  netBilledCents: number;
  /** Collected minus payable payouts — the margin actually in hand. */
  netCollectedCents: number;
}

export function filePayoutTotals(
  bases: PayoutBasis[],
  billedCents: number,
  collectedCents: number,
): FilePayoutTotals {
  let earned = 0;
  let payable = 0;
  for (const b of bases) {
    const p = assigneePayout(b, billedCents, collectedCents);
    earned += p.earnedCents;
    payable += p.payableCents;
  }
  return {
    earnedCents: earned,
    payableCents: payable,
    netBilledCents: billedCents - earned,
    netCollectedCents: collectedCents - payable,
  };
}

/** "70%" / "7.25%" from basis points. */
export function formatPercentBp(bp: number): string {
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

/** "70" or "7.25" (percent) → basis points, clamped 0–100%; null if unparseable. */
export function parsePercentToBp(raw: string): number | null {
  const cleaned = raw.replace(/[%\s]/g, "");
  if (cleaned === "" || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const pct = Number(cleaned);
  if (pct < 0 || pct > 100) return null;
  return Math.round(pct * 100);
}
