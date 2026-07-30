import { withTenant } from "@freehold/db";

/**
 * Per-transaction activity trail: the everyday work on a file, which is what
 * "when was this last touched, and by whom" actually means. Distinct from
 * [logAudit] — that records sensitive events for the compliance view, this
 * records ordinary progress so a quiet file can be spotted.
 *
 * Fire-and-forget, exactly like the audit trail: recording that someone
 * ticked a task must never fail or slow down ticking the task.
 */
export function logActivity(entry: {
  tenantId: string;
  /** Activity is transaction-scoped; a null id is a no-op, not an error. */
  transactionId: string | null | undefined;
  actor: { id?: string | null; name?: string | null } | null;
  /** Stable machine key, e.g. "task.completed". */
  action: string;
  /** Human sentence: "Completed 'Order home warranty'". */
  summary: string;
}): void {
  if (!entry.transactionId) return;
  const transactionId = entry.transactionId;
  withTenant(entry.tenantId, (tx) =>
    tx.transactionActivity.create({
      data: {
        tenantId: entry.tenantId,
        transactionId,
        actorId: entry.actor?.id ?? null,
        actorName: entry.actor?.name?.trim() || "Someone",
        action: entry.action,
        summary: entry.summary.slice(0, 300),
      },
    }),
  ).catch(() => {});
}

/** Trim a user-supplied title for embedding in an activity sentence. */
export function activityTitle(s: string, max = 60): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export interface ActivityEntry {
  id: string;
  at: Date;
  actorName: string;
  summary: string;
}

/**
 * The last N things that happened on a file, newest first — the recap shown
 * on the transaction page. A single "last touched" line answers "is this
 * file stale"; this answers "what actually happened here", which is the
 * question a coordinator has after being away for a day.
 */
export async function recentActivity(
  tenantId: string,
  transactionId: string,
  limit = 6,
): Promise<ActivityEntry[]> {
  return withTenant(tenantId, (tx) =>
    tx.transactionActivity.findMany({
      where: { transactionId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, createdAt: true, actorName: true, summary: true },
    }),
  ).then((rows) =>
    rows.map((r) => ({ id: r.id, at: r.createdAt, actorName: r.actorName, summary: r.summary })),
  );
}
