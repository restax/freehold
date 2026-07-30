/**
 * How a task template entry's date rule reads in the UI.
 *
 * A plain module rather than part of either component that uses it: the row
 * list is a client component and the dependency tree is a server one, and a
 * function exported from a "use client" file becomes a client reference —
 * calling it during a server render fails. Shared logic between the two
 * sides has to live somewhere neutral.
 */

export const ANCHOR_LABEL: Record<string, string> = {
  CONTRACT_DATE: "Contract date",
  CLOSE_DATE: "Close date",
  LIST_DATE: "List date",
  EXPIRE_DATE: "Listing expires",
  MORTGAGE_COMMITMENT_DATE: "Mortgage commitment",
  INSPECTION_DEADLINE_DATE: "Inspection deadline",
  EARNEST_MONEY_DUE_DATE: "Earnest money due",
  TEMPLATE_START: "Day the plan is applied",
  DEPENDENCY: "After another task",
};

/**
 * The date rule in words. Worth spelling out rather than showing
 * "CLOSE_DATE / −1": the offset's sign is the part people get wrong, and
 * "the day before close date" can't be misread the way "−1" can.
 */
export function dateRuleText(
  anchor: string,
  offsetDays: number,
  dependsOnTitle?: string | null,
): string {
  if (anchor === "DEPENDENCY") {
    const target = dependsOnTitle ? `“${dependsOnTitle}”` : "another task";
    if (offsetDays === 0) return `The day ${target} is completed`;
    const n = Math.abs(offsetDays);
    const unit = `${n} day${n === 1 ? "" : "s"}`;
    return offsetDays > 0
      ? `${unit} after ${target} is completed`
      : `${unit} before ${target} is completed`;
  }
  const label = ANCHOR_LABEL[anchor] ?? anchor;
  if (offsetDays === 0) return anchor === "TEMPLATE_START" ? label : `On ${label.toLowerCase()}`;
  const n = Math.abs(offsetDays);
  const unit = `${n} day${n === 1 ? "" : "s"}`;
  return offsetDays > 0
    ? `${unit} after ${label.toLowerCase()}`
    : `${unit} before ${label.toLowerCase()}`;
}
