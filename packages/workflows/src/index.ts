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
export function anchorDate(anchor: AnchorKind, anchors: AnchorDates): Date | null | undefined {
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

/* ------------------------------------------------------------------ *
 * Dependency dating
 *
 * An entry anchored to DEPENDENCY has no date until the entry it waits on
 * is finished: "thank-you email, one day after closing is confirmed" can't
 * be dated in advance, because nobody knows when the confirmation will
 * land. So these entries instantiate undated and are dated later, by the
 * completion itself.
 *
 * The functions below are the whole rule. They're pure so the awkward parts
 * — a chain pointing back at itself, a link into an entry this file's side
 * filtered out — can be tested without a transaction to hang them on.
 * ------------------------------------------------------------------ */

/** The shape dependency logic needs; both template entries and live tasks fit. */
export interface DependencyNode {
  id: string;
  dependsOnId: string | null;
  sortOrder: number;
}

/**
 * Would pointing `entryId` at `candidateId` close a loop?
 *
 * Called before a dependency is saved. Without it two entries can end up
 * waiting on each other, and neither is ever dated — a deadlock that looks
 * like a bug in the dating engine rather than a bad template.
 */
export function wouldCycle(
  entries: readonly DependencyNode[],
  entryId: string,
  candidateId: string,
): boolean {
  if (entryId === candidateId) return true;
  const parent = new Map(entries.map((e) => [e.id, e.dependsOnId]));
  parent.set(entryId, candidateId);
  const seen = new Set<string>();
  let cur: string | null | undefined = entryId;
  while (cur) {
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = parent.get(cur) ?? null;
  }
  return false;
}

export interface DependencyTreeNode<T> {
  entry: T;
  children: DependencyTreeNode<T>[];
}

/**
 * The plan as a forest: entries dated off a transaction date are roots,
 * entries waiting on them nest underneath, in sort order.
 *
 * An entry whose chain doesn't terminate — a loop, or a link to an entry
 * that no longer exists — is shown as a root rather than dropped. A
 * template that quietly hides one of its own tasks is worse than one that
 * shows a task in the wrong place.
 */
export function dependencyTree<T extends DependencyNode>(
  entries: readonly T[],
): DependencyTreeNode<T>[] {
  const byId = new Map(entries.map((e) => [e.id, e]));

  /** Does walking up from here reach a root? False for loops and dangling links. */
  const rooted = (start: T): boolean => {
    const seen = new Set<string>([start.id]);
    let cur = start.dependsOnId;
    while (cur) {
      if (seen.has(cur)) return false;
      const next = byId.get(cur);
      if (!next) return false;
      seen.add(cur);
      cur = next.dependsOnId;
    }
    return true;
  };

  const childrenOf = new Map<string, T[]>();
  const roots: T[] = [];
  for (const e of [...entries].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const parentId = e.dependsOnId;
    if (parentId && rooted(e)) {
      const kids = childrenOf.get(parentId);
      if (kids) kids.push(e);
      else childrenOf.set(parentId, [e]);
    } else {
      roots.push(e);
    }
  }
  // `rooted` already rejected every loop, so this recursion terminates.
  const build = (e: T): DependencyTreeNode<T> => ({
    entry: e,
    children: (childrenOf.get(e.id) ?? []).map(build),
  });
  return roots.map(build);
}

/**
 * The due date a waiting task takes when the task it waits on is completed.
 *
 * Truncated to the completion's UTC day first: due dates are date-only
 * columns, and offsetting from a timestamp would otherwise carry a time of
 * day into a column that can't hold one.
 */
export function dependentDueDate(completedAt: Date, offsetDays: number): Date {
  const day = new Date(
    Date.UTC(completedAt.getUTCFullYear(), completedAt.getUTCMonth(), completedAt.getUTCDate()),
  );
  return addDays(day, offsetDays);
}
