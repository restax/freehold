/**
 * Action-plan engine (pure — no database access here).
 *
 * A plan is a list of task templates anchored to a transaction date
 * (contract date or close date) with a day offset: "Order title" might be
 * CONTRACT_DATE +3, "Final walkthrough" CLOSE_DATE -1. Applying a plan to a
 * transaction turns templates into dated tasks; templates whose anchor date
 * is missing on the transaction produce tasks with no due date rather than
 * being dropped, so the checklist is always complete.
 */

export type AnchorKind = "CONTRACT_DATE" | "CLOSE_DATE";

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

export function computeDueDate(template: PlanTaskTemplate, anchors: AnchorDates): Date | null {
  const base = template.anchor === "CONTRACT_DATE" ? anchors.contractDate : anchors.closeDate;
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
