import { prisma, TaskStatus, TransactionStatus, withTenant } from "@freehold/db";
import { buildIcs, type IcsEvent } from "@/lib/ics";

export const dynamic = "force-dynamic";

const ICS_PRIORITY: Record<string, 1 | 5 | undefined> = { CRITICAL: 1, HIGH: 5, NORMAL: undefined };
const SUMMARY_PREFIX: Record<string, string> = { CRITICAL: "‼ ", HIGH: "! ", NORMAL: "" };

/**
 * One person's subscribe-once calendar: their open, dated tasks plus the
 * closings on files they're assigned to, across this workspace. The token is
 * the capability, same as portal links — no session, so any calendar app can
 * poll it. Regenerating the token (Profile page) is how you revoke a stale
 * subscription, e.g. after a device is lost.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const member = await prisma.member.findUnique({
    where: { calendarToken: token },
    select: { organizationId: true, userId: true },
  });
  if (!member) return new Response("Not found", { status: 404 });
  const { organizationId: tenantId, userId } = member;

  const [user, tenant, tasks, closings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.organization.findUnique({ where: { id: tenantId }, select: { name: true } }),
    withTenant(tenantId, (tx) =>
      tx.task.findMany({
        where: { assigneeId: userId, status: TaskStatus.OPEN, dueDate: { not: null } },
        select: {
          id: true,
          title: true,
          dueDate: true,
          priority: true,
          transaction: { select: { propertyAddress: true } },
        },
      }),
    ),
    withTenant(tenantId, (tx) =>
      tx.transaction.findMany({
        where: {
          assignees: { some: { userId } },
          status: { notIn: [TransactionStatus.CLOSED, TransactionStatus.CANCELLED] },
          closeDate: { not: null },
        },
        select: { id: true, propertyAddress: true, closeDate: true },
      }),
    ),
  ]);

  const events: IcsEvent[] = [];
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const prefix = SUMMARY_PREFIX[t.priority] ?? "";
    const summary = t.transaction ? `${t.title} — ${t.transaction.propertyAddress}` : t.title;
    events.push({
      uid: `task-${t.id}`,
      date: t.dueDate,
      summary: `${prefix}${summary}`,
      priority: ICS_PRIORITY[t.priority],
    });
  }
  for (const t of closings) {
    if (!t.closeDate) continue;
    events.push({
      uid: `close-${t.id}`,
      date: t.closeDate,
      summary: `Closing — ${t.propertyAddress}`,
    });
  }

  const name = `${user?.name ?? "My"} — ${tenant?.name ?? "Freehold"}`;
  return new Response(buildIcs(events, name), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="freehold.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
