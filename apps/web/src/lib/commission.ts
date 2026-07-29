/**
 * Commission wording and parsing for a transaction.
 *
 * Whose commission the percentage describes depends on who the client is. For
 * an individual agent the client *is* the earner, so it reads "Client's
 * commission". For a brokerage or a team the client is the office and the
 * money belongs to one of their agents, so it reads "Agent's commission".
 * Getting this backwards isn't cosmetic — it's the difference between a
 * coordinator entering the office's split and the agent's.
 *
 * Dependency-free (the billing-cadence pattern) so the label rule and the
 * money parsing are unit-tested away from React and Prisma.
 */

/** The label for the commission percentage, given the client's type. */
export function commissionLabel(clientType: string | null | undefined): string {
  if (clientType === "AGENT") return "Client's commission %";
  if (clientType === "BROKERAGE" || clientType === "TEAM") return "Agent's commission %";
  // Title company, lender, other, or no client chosen yet: don't assert whose
  // money it is when we don't know.
  return "Commission %";
}

/**
 * A typed percentage → a number, or null.
 *
 * Accepts "3", "3%", "2.75", " 3 " — a coordinator types the symbol as often
 * as not. Rejects anything above 100: a commission percentage over 100 is a
 * typo (30 for 3.0), and storing it would quietly inflate every derived gross.
 */
export function parseCommissionPct(raw: string): number | null {
  const cleaned = raw.replace(/[%\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

/**
 * A typed dollar amount → whole cents, or null. Mirrors how expected fee is
 * read, so "$12,500.50", "12500.5" and "12500" all land the same way.
 */
export function parseGrossCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/**
 * What the commission is worth against a price, for the hint under the field.
 *
 * Only ever a suggestion: the estimated gross is typed, because the number a
 * coordinator is given by the agent routinely differs from percentage × price
 * once referral splits and flat fees are in play.
 */
export function grossFromPct(pct: number | null, priceDollars: number | null): number | null {
  if (pct == null || priceDollars == null || priceDollars <= 0) return null;
  return Math.round(priceDollars * pct); // dollars × pct/100 × 100 cents
}
