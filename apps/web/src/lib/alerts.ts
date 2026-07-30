import { Prisma, type TenantTx, withTenant } from "@freehold/db";
import {
  type AlertConfig,
  resolveAlertConfig,
  type Staleness,
  staleness,
  startOfDay,
  type UrgentTask,
  urgentOpenTasks,
} from "@/lib/transaction-alerts";

/**
 * Server-side alert query: joins each active transaction to its most recent
 * activity and computes the staleness verdict once, so the dashboard, the
 * transaction page, the briefing email, and the briefing PDF all read the
 * same answer instead of each re-deriving it.
 *
 * The pure rule itself lives in lib/transaction-alerts.ts (and is unit-tested
 * there); this module only fetches and assembles.
 */

export interface LastActivity {
  at: Date;
  actorName: string;
  summary: string;
}

export interface TransactionAlert {
  id: string;
  propertyAddress: string;
  clientName: string | null;
  lastActivity: LastActivity | null;
  staleness: Staleness;
  config: AlertConfig;
  /** Open tasks near their due date with the weekend closing in — see
   *  urgentOpenTasks. Fires regardless of staleness. */
  urgentTasks: UrgentTask[];
}

/** Latest activity row per transaction, in one index-friendly pass. */
async function latestActivityByTransaction(
  tx: TenantTx,
  transactionIds: string[],
): Promise<Map<string, LastActivity>> {
  if (transactionIds.length === 0) return new Map();
  // DISTINCT ON is the right tool here: the (tenant_id, transaction_id,
  // createdAt) index makes this a single ordered scan, where a per-row
  // subquery or fetching every activity row and reducing in JS would not.
  const rows = await tx.$queryRaw<
    Array<{ transaction_id: string; createdAt: Date; actor_name: string; summary: string }>
  >`
    SELECT DISTINCT ON (transaction_id) transaction_id, "createdAt", actor_name, summary
    FROM transaction_activity
    WHERE transaction_id IN (${Prisma.join(transactionIds)})
    ORDER BY transaction_id, "createdAt" DESC
  `;
  return new Map(
    rows.map((r) => [
      r.transaction_id,
      { at: r.createdAt, actorName: r.actor_name, summary: r.summary },
    ]),
  );
}

/**
 * Every open transaction with its last-touched record and staleness verdict.
 * Closed and cancelled files are excluded — a finished file being quiet is
 * the expected outcome, not a problem.
 */
export async function transactionAlerts(
  tenantId: string,
  now: Date = new Date(),
): Promise<TransactionAlert[]> {
  const today = startOfDay(now);
  return withTenant(tenantId, async (tx) => {
    const txns = await tx.transaction.findMany({
      where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
      select: {
        id: true,
        propertyAddress: true,
        createdAt: true,
        closeDate: true,
        mortgageCommitmentDate: true,
        inspectionDeadlineDate: true,
        client: { select: { name: true, alertConfig: true } },
        tasks: { where: { status: "OPEN" }, select: { id: true, title: true, dueDate: true } },
      },
    });
    const activity = await latestActivityByTransaction(
      tx,
      txns.map((t) => t.id),
    );
    return txns.map((t) => {
      const config = resolveAlertConfig(t.client?.alertConfig);
      const last = activity.get(t.id) ?? null;
      return {
        id: t.id,
        propertyAddress: t.propertyAddress,
        clientName: t.client?.name ?? null,
        lastActivity: last,
        config,
        staleness: staleness({
          lastTouchedAt: last?.at ?? null,
          createdAt: t.createdAt,
          dates: {
            closeDate: t.closeDate,
            mortgageCommitmentDate: t.mortgageCommitmentDate,
            inspectionDeadlineDate: t.inspectionDeadlineDate,
          },
          config,
          today,
        }),
        urgentTasks: urgentOpenTasks(
          t.tasks.map((task) => ({ ...task, status: "OPEN" })),
          today,
        ),
      };
    });
  });
}

/**
 * Alerts worth showing, worst first: a task whose due date is closing in on
 * the weekend outranks everything else — it's the one case that isn't
 * silenced by the file having been touched for something unrelated — then
 * flagged files, then merely-approaching ones, then by how close the
 * critical date is, then by how long it's been quiet. This is the order the
 * dashboard and the briefing both present.
 */
export function rankAlerts(alerts: TransactionAlert[]): TransactionAlert[] {
  return alerts
    .filter((a) => a.staleness.stale || a.staleness.escalatedBy || a.urgentTasks.length > 0)
    .sort((a, b) => {
      const aUrgent = a.urgentTasks[0]?.businessDaysAway ?? Number.POSITIVE_INFINITY;
      const bUrgent = b.urgentTasks[0]?.businessDaysAway ?? Number.POSITIVE_INFINITY;
      if (aUrgent !== bUrgent) return aUrgent - bUrgent;
      if (a.staleness.stale !== b.staleness.stale) return a.staleness.stale ? -1 : 1;
      const aDays = a.staleness.escalatedBy?.daysAway ?? Number.POSITIVE_INFINITY;
      const bDays = b.staleness.escalatedBy?.daysAway ?? Number.POSITIVE_INFINITY;
      if (aDays !== bDays) return aDays - bDays;
      return b.staleness.quietDays - a.staleness.quietDays;
    });
}

/** The alert for one transaction, for the transaction detail page. */
export async function transactionAlert(
  tenantId: string,
  transactionId: string,
  now: Date = new Date(),
): Promise<TransactionAlert | null> {
  const all = await transactionAlerts(tenantId, now);
  return all.find((a) => a.id === transactionId) ?? null;
}
