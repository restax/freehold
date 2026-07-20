import { prisma, withTenant } from "@freehold/db";
import { buildIcs, type IcsEvent } from "@/lib/ics";

export const dynamic = "force-dynamic";

/**
 * Subscribe-able calendar feed per portal link: every visible dated item.
 * The token is the capability, same as the portal pages; updating a date in
 * Freehold updates the feed on the subscriber's next refresh.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.portalLink.findUnique({ where: { token } });
  if (!link || link.revokedAt) return new Response("Not found", { status: 404 });

  const events: IcsEvent[] = [];
  let name = "Freehold dates";

  if (link.audience === "AGENT" && link.clientId) {
    const clientId = link.clientId;
    const data = await withTenant(link.tenantId, async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: { name: true },
      });
      const txns = await tx.transaction.findMany({
        where: { clientId, status: { notIn: ["CLOSED", "CANCELLED"] } },
        select: {
          id: true,
          propertyAddress: true,
          closeDate: true,
          contractDate: true,
          tasks: {
            where: { visibleToAgent: true, status: "OPEN", dueDate: { not: null } },
            select: { id: true, title: true, dueDate: true },
          },
        },
      });
      return { client, txns };
    });
    name = `${data.client?.name ?? "Agent"} — transaction dates`;
    for (const t of data.txns) {
      if (t.closeDate) {
        events.push({
          uid: `close-${t.id}`,
          date: t.closeDate,
          summary: `Closing — ${t.propertyAddress}`,
        });
      }
      for (const task of t.tasks) {
        if (task.dueDate) {
          events.push({
            uid: `task-${task.id}`,
            date: task.dueDate,
            summary: `${task.title} — ${t.propertyAddress}`,
          });
        }
      }
    }
  } else if (link.audience === "CLIENT" && link.transactionId) {
    const transactionId = link.transactionId;
    const txn = await withTenant(link.tenantId, (tx) =>
      tx.transaction.findUnique({
        where: { id: transactionId },
        select: {
          propertyAddress: true,
          closeDate: true,
          contractDate: true,
          tasks: link.showTasks
            ? {
                where: { visibleToClient: true, dueDate: { not: null } },
                select: { id: true, title: true, dueDate: true },
              }
            : false,
        },
      }),
    );
    if (!txn) return new Response("Not found", { status: 404 });
    name = `${txn.propertyAddress} — key dates`;
    if (txn.closeDate) {
      events.push({
        uid: `close-${link.transactionId}`,
        date: txn.closeDate,
        summary: `Closing day — ${txn.propertyAddress}`,
      });
    }
    for (const task of txn.tasks ?? []) {
      if (task.dueDate) {
        events.push({
          uid: `task-${task.id}`,
          date: task.dueDate,
          summary: task.title,
        });
      }
    }
  } else {
    return new Response("Not found", { status: 404 });
  }

  return new Response(buildIcs(events, name), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="freehold.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
