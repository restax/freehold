/** Task priority: ordering, escalation, and badge styling shared by views. */

export const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2 };

export const PRIORITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-amber-100 text-amber-800",
  NORMAL: "",
};

export const PRIORITY_LABEL: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  NORMAL: "",
};

/**
 * Effective priority with escalation: an amendment task (proposedFor set)
 * whose governed date is ≤ 2 days away is CRITICAL no matter what — it must
 * be the first thing the TC sees that day.
 */
export function effectivePriority(
  task: { priority: string; proposedFor?: string | null },
  txnDates?: { contractDate: Date | null; closeDate: Date | null } | null,
): string {
  if (task.proposedFor && txnDates) {
    const governed =
      task.proposedFor === "contractDate" ? txnDates.contractDate : txnDates.closeDate;
    if (governed) {
      const daysAway = (governed.getTime() - Date.now()) / 86400000;
      if (daysAway <= 2) return "CRITICAL";
    }
  }
  return task.priority;
}

export function byPriorityThenDate<
  T extends { dueDate: Date | null; priority: string; proposedFor?: string | null },
>(txnDatesOf: (t: T) => { contractDate: Date | null; closeDate: Date | null } | null) {
  return (a: T, b: T): number => {
    const pa = PRIORITY_RANK[effectivePriority(a, txnDatesOf(a))] ?? 2;
    const pb = PRIORITY_RANK[effectivePriority(b, txnDatesOf(b))] ?? 2;
    if (pa !== pb) return pa - pb;
    const da = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const db = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return da - db;
  };
}
