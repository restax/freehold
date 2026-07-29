/**
 * Which side of the deal our client is on, worked out from the contract.
 *
 * A contract names a buyer's agent and a listing agent, but never says which
 * one hired us — so the coordinator picks the client at upload and we match
 * that client against the two agents the extractor found. The same agent is a
 * buyer's agent on one file and the listing agent on the next, so the side
 * can't be stored on the client; it has to be derived per deal.
 *
 * Dependency-free (the billing-cadence pattern) and tested, because side
 * decides which fields the form shows, which price column means anything, and
 * which agent the client portal hides. Guessing it wrong is quietly expensive,
 * so an uncertain match is reported as uncertain rather than resolved.
 */

export type DerivedSide = "BUY_SIDE" | "SELL_SIDE" | "DUAL";

export interface SideMatch {
  side: DerivedSide;
  /** HIGH when exactly one side matched; LOW when we're guessing. */
  confidence: "HIGH" | "MEDIUM" | "LOW";
  /** The agent name that produced the match, for the review row's citation. */
  matchedOn: string | null;
}

/**
 * Names are compared loosely: contracts write "Raman, Priya", "Priya Raman",
 * "PRIYA RAMAN, ESQ." and our records hold whichever the coordinator typed.
 * Punctuation, case, ordering and common suffixes are all noise here.
 */
const SUFFIXES = new Set(["esq", "jr", "sr", "ii", "iii", "iv", "realtor", "broker", "agent"]);

export function nameTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !SUFFIXES.has(t))
    .sort();
}

/**
 * True when two names plausibly refer to the same person.
 *
 * Requires every token of the shorter name to appear in the longer one, so
 * "Priya Raman" matches "Raman, Priya M." and "Priya Raman Realty", but
 * "Priya Raman" and "Priya Chen" do not. A single shared token isn't enough —
 * "Smith" alone would match half a brokerage.
 */
export function namesMatch(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length < 2 && long.length >= 2) return false;
  return short.every((t) => long.includes(t));
}

/**
 * Our client (and the agents under them) matched against the contract's two
 * agents. Returns null when neither side matches — better to leave the side
 * unset and ask than to file a listing as a buy-side deal.
 */
export function deriveSide(input: {
  /** The client's own name, plus any agents on their roster. */
  clientNames: readonly string[];
  buyerAgent: string | null;
  listingAgent: string | null;
}): SideMatch | null {
  const names = input.clientNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return null;

  const hit = (agent: string | null) =>
    agent?.trim() ? (names.find((n) => namesMatch(n, agent)) ?? null) : null;

  const buyHit = hit(input.buyerAgent);
  const sellHit = hit(input.listingAgent);

  // Named on both sides: a genuine dual agency, and the one case where the
  // contract really does answer the question outright.
  if (buyHit && sellHit) {
    return { side: "DUAL", confidence: "HIGH", matchedOn: buyHit };
  }
  if (buyHit) return { side: "BUY_SIDE", confidence: "HIGH", matchedOn: buyHit };
  if (sellHit) return { side: "SELL_SIDE", confidence: "HIGH", matchedOn: sellHit };
  return null;
}
