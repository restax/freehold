/**
 * The transaction lifecycle: which statuses exist, in what order, and which
 * of them mean the file is still live work.
 *
 * Dependency-free (the billing-cadence pattern). The values themselves are a
 * Prisma enum, but their *order* and their split into open/closed are product
 * decisions that drive saved views, the plan limit, and every status select —
 * so they live in one tested place instead of being re-listed at each call
 * site. A status hand-listed in five files is a status that quietly goes
 * missing from one of them.
 */

/** Every status, in the order a file moves through them. */
export const TRANSACTION_STATUSES = [
  "DRAFT",
  "COMING_SOON",
  "ACTIVE",
  "TMP_OFF_MARKET",
  "UNDER_CONTRACT",
  "PENDING",
  "CLOSED",
  "CANCELLED",
] as const;

export type TransactionStatusValue = (typeof TRANSACTION_STATUSES)[number];

/**
 * Finished, one way or the other.
 *
 * This is the authoritative half of the split, and everything else derives
 * from it: a new lifecycle status is open until someone says otherwise, which
 * is the direction that fails safe. Listing the open ones by hand is how a
 * new status silently vanishes from every saved view.
 */
export const CLOSED_STATUSES = ["CLOSED", "CANCELLED"] as const;

/** Still live work, not history. */
export const OPEN_STATUSES = TRANSACTION_STATUSES.filter(
  (s) => !(CLOSED_STATUSES as readonly string[]).includes(s),
);

export function isOpenStatus(status: string): boolean {
  return !(CLOSED_STATUSES as readonly string[]).includes(status);
}

/**
 * Statuses we still accept from outside but no longer offer.
 *
 * LISTING was a documented value of the public API and a header synonym in
 * the CSV importer. An integration still sending it must keep working: the
 * alternative is a GET that silently filters nothing and a POST that quietly
 * files the deal as UNDER_CONTRACT, neither of which anyone would notice.
 */
const STATUS_ALIASES: Record<string, TransactionStatusValue> = { LISTING: "ACTIVE" };

/**
 * A status from an untrusted source (public API, importer, voice command)
 * mapped onto the current lifecycle, or null if it isn't one of ours.
 */
export function normalizeStatus(raw: unknown): TransactionStatusValue | null {
  if (typeof raw !== "string") return null;
  const key = raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if ((TRANSACTION_STATUSES as readonly string[]).includes(key)) {
    return key as TransactionStatusValue;
  }
  return STATUS_ALIASES[key] ?? null;
}

/**
 * Status choices grouped for a <select>, so a coordinator scanning the list
 * sees where the file is in its life rather than one flat run of eight
 * options. Labels come from STATUS_LABEL at the call site — this module
 * stays free of display strings so it can be tested without them.
 */
export function statusGroups(): Array<{ group: string; statuses: TransactionStatusValue[] }> {
  return [
    { group: "Open", statuses: OPEN_STATUSES as TransactionStatusValue[] },
    { group: "Closed", statuses: [...CLOSED_STATUSES] },
  ];
}
