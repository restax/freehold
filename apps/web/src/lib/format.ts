export function fmtDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A date the way someone reads a deadline list: "Jul 30".
 *
 * The full ISO date is right when the exact day is the point (a stored value,
 * an audit line). In a list of a dozen deadlines it's mostly noise — every row
 * repeats the same "2026-" prefix, and the part that differs is buried at the
 * end.
 *
 * **The year comes back when it isn't the current one.** Dropping it entirely
 * would render a closing six months out as a bare "Jan 5", which reads as
 * *this* January — i.e. long overdue rather than upcoming. `now` is injected
 * so that boundary is testable rather than a thing we hope holds in December.
 *
 * UTC throughout, matching fmtDate: these are calendar dates stored at UTC
 * midnight, so reading them in local time slides them a day backwards
 * anywhere west of UTC (and this project is written from JST, where every
 * date would land on the day before).
 */
export function fmtDayMonth(d: Date | null | undefined, now: Date = new Date()): string {
  if (!d) return "—";
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return d.getUTCFullYear() === now.getUTCFullYear() ? base : `${base}, ${d.getUTCFullYear()}`;
}

export function fmtMoney(n: number | null | undefined): string {
  return n == null ? "—" : `$${n.toLocaleString("en-US")}`;
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  COMING_SOON: "Coming soon",
  ACTIVE: "Active",
  // Spelled out rather than the industry's "Tmp Off Market" — see the wording
  // table in CLAUDE.md.
  TMP_OFF_MARKET: "Temporarily off market",
  UNDER_CONTRACT: "Under contract",
  PENDING: "Pending",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const SIDE_LABEL: Record<string, string> = {
  BUY_SIDE: "Buy side",
  SELL_SIDE: "Sell side",
  DUAL: "Dual",
};

export const ROLE_LABEL: Record<string, string> = {
  BUYER: "Buyer",
  SELLER: "Seller",
  BUYER_AGENT: "Buyer's agent",
  LISTING_AGENT: "Listing agent",
  LENDER: "Lender",
  TITLE_COMPANY: "Title company",
  INSPECTOR: "Inspector",
  APPRAISER: "Appraiser",
  ATTORNEY: "Attorney",
  OTHER: "Other",
};
