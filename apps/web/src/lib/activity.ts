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
  /** The file this was about, so its own row can show when it was sent. */
  documentId?: string | null;
  /** The portal link this was about, for the same reason. */
  portalLinkId?: string | null;
  /** Set from a task's own screen, so the task can show its own work log
   *  while the row still appears in the file's activity feed. */
  taskId?: string | null;
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
        documentId: entry.documentId ?? null,
        portalLinkId: entry.portalLinkId ?? null,
        taskId: entry.taskId ?? null,
      },
    }),
  ).catch(() => {});
}

/**
 * Per-attachment send records. One email with three files attached writes
 * three of these, one per file, so each document's own row can answer "was
 * this sent, to whom, when". They're kept out of the transaction's activity
 * feed — see [recentActivity] — because the single "Emailed bob@… — subject"
 * row already tells that story once, and three near-identical lines would
 * bury everything else that happened that day.
 */
export const DOCUMENT_EMAILED = "document.emailed";

export interface SendRecord {
  at: Date;
  actorName: string;
  summary: string;
}

/**
 * The last time each document on a file was emailed out, keyed by document
 * id. A lender or client asks "did you send that?", and the honest answer
 * has to come from what actually went out, not from memory.
 */
export async function lastSentByDocument(
  tenantId: string,
  transactionId: string,
): Promise<Map<string, SendRecord>> {
  const rows = await withTenant(tenantId, (tx) =>
    tx.transactionActivity.findMany({
      where: { transactionId, documentId: { not: null }, action: DOCUMENT_EMAILED },
      orderBy: { createdAt: "desc" },
      select: { documentId: true, createdAt: true, actorName: true, summary: true },
    }),
  );
  const out = new Map<string, SendRecord>();
  for (const r of rows) {
    // Rows arrive newest-first, so the first one seen per document is the
    // most recent send.
    if (r.documentId && !out.has(r.documentId)) {
      out.set(r.documentId, { at: r.createdAt, actorName: r.actorName, summary: r.summary });
    }
  }
  return out;
}

/** The same, for portal links. */
export async function lastSentByPortalLink(
  tenantId: string,
  transactionId: string,
): Promise<Map<string, SendRecord>> {
  const rows = await withTenant(tenantId, (tx) =>
    tx.transactionActivity.findMany({
      where: { transactionId, portalLinkId: { not: null }, action: "portal.emailed" },
      orderBy: { createdAt: "desc" },
      select: { portalLinkId: true, createdAt: true, actorName: true, summary: true },
    }),
  );
  const out = new Map<string, SendRecord>();
  for (const r of rows) {
    if (r.portalLinkId && !out.has(r.portalLinkId)) {
      out.set(r.portalLinkId, { at: r.createdAt, actorName: r.actorName, summary: r.summary });
    }
  }
  return out;
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
      // Per-attachment rows belong to their document, not to the feed.
      where: { transactionId, action: { not: DOCUMENT_EMAILED } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, createdAt: true, actorName: true, summary: true },
    }),
  ).then((rows) =>
    rows.map((r) => ({ id: r.id, at: r.createdAt, actorName: r.actorName, summary: r.summary })),
  );
}
