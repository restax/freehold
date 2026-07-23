/** Task priority: ordering, escalation, and badge styling shared by views. */

import type { CSSProperties } from "react";

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
 * Per-workspace priority colours. The dashboard layout publishes
 * `--priority-high` / `--priority-critical` (from the tenant's appearance
 * config, defaulting to amber/red); these helpers read them so a badge, flag,
 * or calendar pill reflects the chosen colour without threading props. A soft
 * tinted fill is derived from the same hue via color-mix.
 */
function priorityVar(priority: string): string | null {
  if (priority === "CRITICAL") return "var(--priority-critical)";
  if (priority === "HIGH") return "var(--priority-high)";
  return null;
}

/** Pill style (tinted fill + saturated text) for a High/Critical badge. */
export function priorityBadgeStyle(priority: string): CSSProperties | undefined {
  const v = priorityVar(priority);
  if (!v) return undefined;
  return { color: v, backgroundColor: `color-mix(in srgb, ${v} 14%, white)` };
}

/** Flag/glyph colour for a High/Critical task. */
export function priorityColorStyle(priority: string): CSSProperties | undefined {
  const v = priorityVar(priority);
  return v ? { color: v } : undefined;
}

/**
 * Whole-row tint for a High/Critical task. Reads the per-priority highlight
 * var published by the layout, which is `transparent` unless the workspace
 * opted this priority into row highlighting — so this is safe to apply
 * unconditionally to any row.
 */
export function rowHighlightStyle(priority: string): CSSProperties | undefined {
  if (priority === "CRITICAL") return { backgroundColor: "var(--row-highlight-critical)" };
  if (priority === "HIGH") return { backgroundColor: "var(--row-highlight-high)" };
  return undefined;
}

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
