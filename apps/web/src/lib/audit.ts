import { withTenant } from "@freehold/db";

/**
 * Tenant audit trail: one row per meaningful action (deletes, portal access
 * changes, plan events). Fire-and-forget — recording history must never fail
 * or slow the action itself. Viewable under Settings by workspace admins.
 */
export function logAudit(entry: {
  tenantId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  summary: string;
  subjectType?: string;
  subjectId?: string;
}): void {
  withTenant(entry.tenantId, (tx) =>
    tx.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        summary: entry.summary.slice(0, 500),
        subjectType: entry.subjectType,
        subjectId: entry.subjectId,
      },
    }),
  ).catch(() => {});
}
