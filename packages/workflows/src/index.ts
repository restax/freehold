/**
 * Action-plan engine (pure — no database access here).
 *
 * A plan is a list of task templates anchored to a transaction date
 * (contract date, close date, list date, ...) with a day offset: "Order
 * title" might be CONTRACT_DATE +3, "Final walkthrough" CLOSE_DATE -1.
 * Applying a plan to a transaction turns templates into dated tasks;
 * templates whose anchor date is missing on the transaction produce tasks
 * with no due date rather than being dropped, so the checklist is always
 * complete.
 *
 * Two anchors this module can't resolve on its own:
 * - TEMPLATE_START — the day the plan was applied. The caller supplies it as
 *   `anchors.templateStart` (normally `new Date()`), same as any other date.
 * - DEPENDENCY — dated off another task template entry's own completion,
 *   which doesn't exist yet at instantiation time. `computeDueDate` always
 *   returns null for it; the caller resolves dependency chains separately
 *   once live tasks exist (see lib/actions/tasks.ts).
 */

export type AnchorKind =
  | "CONTRACT_DATE"
  | "CLOSE_DATE"
  | "LIST_DATE"
  | "EXPIRE_DATE"
  | "MORTGAGE_COMMITMENT_DATE"
  | "INSPECTION_DEADLINE_DATE"
  | "EARNEST_MONEY_DUE_DATE"
  | "TEMPLATE_START"
  | "DEPENDENCY";

export interface PlanTaskTemplate {
  title: string;
  anchor: AnchorKind;
  offsetDays: number;
  sortOrder: number;
  assigneeRole?: string | null;
}

export interface AnchorDates {
  contractDate?: Date | null;
  closeDate?: Date | null;
  listDate?: Date | null;
  expireDate?: Date | null;
  mortgageCommitmentDate?: Date | null;
  inspectionDeadlineDate?: Date | null;
  earnestMoneyDueDate?: Date | null;
  /** The day the plan is being applied — supply `new Date()` unless testing. */
  templateStart?: Date | null;
}

export interface InstantiatedTask {
  title: string;
  dueDate: Date | null;
  sortOrder: number;
  assigneeRole: string | null;
}

/** UTC-safe day arithmetic (dates are stored as date-only columns). */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Which transaction date (if any) an anchor kind reads from. DEPENDENCY has
 *  no transaction date — it isn't resolvable here at all (see file header). */
function anchorDate(anchor: AnchorKind, anchors: AnchorDates): Date | null | undefined {
  switch (anchor) {
    case "CONTRACT_DATE":
      return anchors.contractDate;
    case "CLOSE_DATE":
      return anchors.closeDate;
    case "LIST_DATE":
      return anchors.listDate;
    case "EXPIRE_DATE":
      return anchors.expireDate;
    case "MORTGAGE_COMMITMENT_DATE":
      return anchors.mortgageCommitmentDate;
    case "INSPECTION_DEADLINE_DATE":
      return anchors.inspectionDeadlineDate;
    case "EARNEST_MONEY_DUE_DATE":
      return anchors.earnestMoneyDueDate;
    case "TEMPLATE_START":
      return anchors.templateStart;
    case "DEPENDENCY":
      return null;
  }
}

export function computeDueDate(template: PlanTaskTemplate, anchors: AnchorDates): Date | null {
  const base = anchorDate(template.anchor, anchors);
  if (!base) return null;
  return addDays(base, template.offsetDays);
}

export function instantiatePlan(
  templates: readonly PlanTaskTemplate[],
  anchors: AnchorDates,
): InstantiatedTask[] {
  return [...templates]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({
      title: t.title,
      dueDate: computeDueDate(t, anchors),
      sortOrder: t.sortOrder,
      assigneeRole: t.assigneeRole ?? null,
    }));
}
