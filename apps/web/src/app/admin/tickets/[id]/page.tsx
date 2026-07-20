import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TicketBadge } from "@/components/badges";
import { adminReplyToTicket, adminSetTicketStatus } from "@/lib/actions/support";
import { fmtDate } from "@/lib/format";
import { isOperator } from "@/lib/operator";
import { btn, btnGhost, card, input } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function AdminTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tenant?: string }>;
}) {
  if (!(await isOperator())) notFound();
  const { id } = await params;
  const { tenant: tenantId } = await searchParams;
  if (!tenantId) notFound();

  const [org, ticket] = await Promise.all([
    prisma.organization.findUnique({ where: { id: tenantId }, select: { name: true } }),
    withTenant(tenantId, (tx) =>
      tx.supportTicket.findUnique({
        where: { id },
        include: {
          user: { select: { name: true, email: true } },
          replies: { orderBy: { createdAt: "asc" } },
        },
      }),
    ),
  ]);
  if (!ticket) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <Link href="/admin/tickets" className="text-sm text-stone-500 hover:underline">
          ← Support tickets
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{ticket.subject}</h1>
          <TicketBadge status={ticket.status} />
        </div>
        <p className="mt-1 text-sm text-stone-500">
          {org?.name} · {ticket.user?.name} ({ticket.user?.email}) · {fmtDate(ticket.createdAt)}
          {ticket.pagePath ? ` · ${ticket.pagePath}` : ""}
        </p>
      </div>

      <section className={card}>
        <p className="whitespace-pre-wrap text-sm text-stone-700">{ticket.body}</p>
      </section>

      {ticket.replies.length > 0 && (
        <section className="flex flex-col gap-3">
          {ticket.replies.map((r) => (
            <div
              key={r.id}
              className={`${card} ${r.fromOperator ? "border-brand-200 bg-brand-50/40" : ""}`}
            >
              <p className="text-xs font-medium text-stone-500">
                {r.fromOperator ? "You (support)" : r.authorEmail}
                <span className="ml-1.5 font-normal text-stone-400">{fmtDate(r.createdAt)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{r.body}</p>
            </div>
          ))}
        </section>
      )}

      <section className={card}>
        <h2 className="mb-2 font-medium">Reply</h2>
        <form action={adminReplyToTicket} className="flex flex-col gap-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="ticketId" value={ticket.id} />
          <textarea name="body" required rows={4} className={input} />
          <div>
            <button type="submit" className={btn}>
              Send reply
            </button>
          </div>
        </form>
      </section>

      <form action={adminSetTicketStatus}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="ticketId" value={ticket.id} />
        <input type="hidden" name="status" value={ticket.status === "CLOSED" ? "OPEN" : "CLOSED"} />
        <button type="submit" className={btnGhost}>
          {ticket.status === "CLOSED" ? "Reopen" : "Close ticket"}
        </button>
      </form>
    </main>
  );
}
