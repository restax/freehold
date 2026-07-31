/**
 * Which side of the deal each participant sits on, and how to order them.
 *
 * A TC works one side. The people on that side are theirs to chase; the
 * people on the other side are someone else's, and the ones in the middle —
 * title, lender, inspector — answer to whoever booked them. Sorting the list
 * that way means the names you act on are at the top instead of wherever the
 * row happened to be created.
 *
 * On a dual-side file there is no "other side" to push down, so no grouping
 * applies and the list stays in its natural order.
 */

export type PartyGroup = "ours" | "shared" | "theirs";

const BUY_ROLES = new Set(["BUYER", "BUYER_AGENT"]);
const SELL_ROLES = new Set(["SELLER", "LISTING_AGENT"]);

/** The group heading shown above each run of rows. */
export const GROUP_LABEL: Record<PartyGroup, string> = {
  ours: "Our side",
  shared: "Both sides",
  theirs: "The other side",
};

/**
 * Where a role sits relative to the side we work. Roles that belong to
 * neither side — title, lender, inspector, appraiser — are always "shared".
 */
export function partyGroup(role: string, side: string): PartyGroup {
  const roleSide = BUY_ROLES.has(role) ? "BUY_SIDE" : SELL_ROLES.has(role) ? "SELL_SIDE" : null;
  if (!roleSide) return "shared";
  return roleSide === side ? "ours" : "theirs";
}

const ORDER: Record<PartyGroup, number> = { ours: 0, shared: 1, theirs: 2 };

/**
 * The parties re-ordered ours → shared → theirs, stable within each group.
 * Returns the input untouched for a dual-side file.
 */
export function groupPartiesBySide<T extends { role: string }>(
  parties: T[],
  side: string,
): Array<{ party: T; group: PartyGroup; firstOfGroup: boolean }> {
  const grouped = side === "BUY_SIDE" || side === "SELL_SIDE";
  const withGroup = parties.map((party) => ({
    party,
    group: grouped ? partyGroup(party.role, side) : ("ours" as PartyGroup),
  }));
  if (grouped) withGroup.sort((a, b) => ORDER[a.group] - ORDER[b.group]);
  return withGroup.map((row, i) => ({
    ...row,
    firstOfGroup: grouped && (i === 0 || withGroup[i - 1].group !== row.group),
  }));
}
