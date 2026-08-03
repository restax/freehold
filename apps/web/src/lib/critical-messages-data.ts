/**
 * Assembles the critical messages currently due for one member of one
 * workspace — the side-effecting half of the broadcast system. Kept apart
 * from the pure messageIsDue (critical-messages.ts) so that function stays
 * dependency-free and testable with an injected clock; this one touches
 * Prisma and has one side effect of its own, matching how refreshSummary's
 * claim-then-write is kept apart from isStale.
 */

import { prisma, withTenant } from "@freehold/db";
import { type MessageDueContext, messageIsDue } from "./critical-messages";

export interface DueCriticalMessage {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
  urgent: boolean;
}

export async function dueCriticalMessagesFor(
  tenantId: string,
  memberId: string,
): Promise<DueCriticalMessage[]> {
  // CriticalMessage carries no tenant column and no RLS — it's operator
  // content, the same root-table shape as VendorAd — so this is a bare read,
  // same as Organization (also un-RLS'd; "no RLS by design" per its own
  // admin-page comment).
  const [messages, org] = await Promise.all([
    prisma.criticalMessage.findMany({
      orderBy: [{ urgent: "desc" }, { createdAt: "asc" }],
    }),
    prisma.organization.findUnique({ where: { id: tenantId }, select: { hasSampleData: true } }),
  ]);
  if (messages.length === 0) return [];

  const chainedIds = [
    ...new Set(
      messages.map((m) => m.triggerAfterMessageId).filter((id): id is string => id != null),
    ),
  ];

  const dueMessages = await withTenant(tenantId, async (tx) => {
    const [realTransactionCount, shownRows, dismissedRows] = await Promise.all([
      tx.transaction.count({ where: { isSample: false } }),
      chainedIds.length > 0
        ? tx.messageShownAt.findMany({ where: { messageId: { in: chainedIds } } })
        : Promise.resolve([]),
      tx.criticalMessageDismissal.findMany({ where: { memberId }, select: { messageId: true } }),
    ]);
    const shownAtByMessageId = new Map(shownRows.map((r) => [r.messageId, r.firstShownAt]));
    const dismissedIds = new Set(dismissedRows.map((r) => r.messageId));

    const due = messages.filter((m) => {
      if (dismissedIds.has(m.id)) return false;
      const ctx: MessageDueContext = {
        trigger: m.trigger,
        triggerDelayDays: m.triggerDelayDays,
        hasSampleData: org?.hasSampleData ?? false,
        realTransactionCount,
        afterMessageFirstShownAt: m.triggerAfterMessageId
          ? (shownAtByMessageId.get(m.triggerAfterMessageId) ?? null)
          : null,
      };
      return messageIsDue(ctx);
    });

    // Pin "first shown" for this workspace, once, the moment a message
    // becomes due — this is the clock DAYS_AFTER_MESSAGE counts from for
    // whatever chains off it, so it must be written rather than derived.
    // skipDuplicates makes this idempotent without a separate lookup: an
    // existing row is left alone, a concurrent duplicate insert just no-ops.
    if (due.length > 0) {
      await tx.messageShownAt.createMany({
        data: due.map((m) => ({ tenantId, messageId: m.id })),
        skipDuplicates: true,
      });
    }

    return due;
  });

  return dueMessages.map((m) => ({
    id: m.id,
    title: m.title,
    body: m.body,
    linkUrl: m.linkUrl,
    urgent: m.urgent,
  }));
}
