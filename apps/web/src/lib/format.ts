export function fmtDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export function fmtMoney(n: number | null | undefined): string {
  return n == null ? "—" : `$${n.toLocaleString("en-US")}`;
}

export const STATUS_LABEL: Record<string, string> = {
  LISTING: "Listing",
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

export const STATUS_BADGE: Record<string, string> = {
  LISTING: "bg-sky-100 text-sky-800",
  UNDER_CONTRACT: "bg-amber-100 text-amber-800",
  PENDING: "bg-violet-100 text-violet-800",
  CLOSED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-stone-200 text-stone-600",
};
