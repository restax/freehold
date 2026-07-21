import { prisma, withTenant } from "@freehold/db";
import { getMemberRole } from "@/lib/tenant";

/**
 * "Unread support" for the sidebar badge: operator/Slack replies that landed
 * after this person last opened the Support page in this workspace. Only
 * fromOperator replies count — a tenant's own replies are never "new" to them.
 * Visibility mirrors the Support page exactly (a member sees their own tickets;
 * an owner/admin sees the whole workspace's), so the badge can never hint at a
 * reply on a ticket the person can't open.
 */
export async function supportUnreadCount(tenantId: string, userId: string): Promise<number> {
  const [member, role] = await Promise.all([
    prisma.member.findFirst({
      where: { organizationId: tenantId, userId },
      select: { supportSeenAt: true },
    }),
    getMemberRole(tenantId, userId),
  ]);
  const isAdmin = role === "owner" || role === "admin";
  const seenAt = member?.supportSeenAt ?? null;

  return withTenant(tenantId, (tx) =>
    tx.supportTicketReply.count({
      where: {
        fromOperator: true,
        ...(seenAt ? { createdAt: { gt: seenAt } } : {}),
        ...(isAdmin ? {} : { ticket: { userId } }),
      },
    }),
  );
}

/** Stamp "seen now" for this person — called when they open the Support page. */
export async function markSupportSeen(tenantId: string, userId: string): Promise<void> {
  await prisma.member
    .updateMany({
      where: { organizationId: tenantId, userId },
      data: { supportSeenAt: new Date() },
    })
    .catch(() => {});
}
