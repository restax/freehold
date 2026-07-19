import { prisma } from "@freehold/db";

/**
 * Tenant wording for transaction sides. The industry doesn't agree — sell
 * side, sale side, list side — so each workspace picks its own labels and
 * they apply everywhere sides are shown: lists, forms, portals, intake.
 */
export interface SideLabels {
  buy: string;
  sell: string;
}

export const DEFAULT_SIDE_LABELS: SideLabels = { buy: "Buy side", sell: "Sell side" };

export function parseSideLabels(raw: unknown): SideLabels {
  const c = raw as Partial<SideLabels> | null;
  return {
    buy: c?.buy?.trim() || DEFAULT_SIDE_LABELS.buy,
    sell: c?.sell?.trim() || DEFAULT_SIDE_LABELS.sell,
  };
}

export async function tenantSideLabels(tenantId: string): Promise<SideLabels> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { sideLabels: true },
  });
  return parseSideLabels(org?.sideLabels);
}

/** Map a TransactionSide enum value to the tenant's wording. */
export function sideLabel(side: string, labels: SideLabels): string {
  if (side === "BUY_SIDE") return labels.buy;
  if (side === "SELL_SIDE") return labels.sell;
  if (side === "DUAL") return `Dual (${labels.buy} + ${labels.sell})`;
  return side;
}

/** The three side choices for selects, in tenant wording. */
export function sideChoices(labels: SideLabels): Array<[value: string, label: string]> {
  return [
    ["BUY_SIDE", labels.buy],
    ["SELL_SIDE", labels.sell],
    ["DUAL", `Dual (${labels.buy} + ${labels.sell})`],
  ];
}
