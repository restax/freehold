import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TicketBadge } from "@/components/badges";
import { fmtDate } from "@/lib/format";
import { isOperator } from "@/lib/operator";
import { card } from "@/lib/ui";

export const dynamic = "force-dynamic";

const STATUS_RANK: Record<string, number> = { OPEN: 0, ANSWERED: 1, CLOSED: 2 };

/**
 * Every ticket across every workspace. support_ticket carries RLS, so this
 * loops withTenant per org — same tradeoff the main /admin page already makes
 * for its per-org aggregate stats. Fine at today's ticket volume.
 */
export default async function AdminTicketsPage() {
  if (!(await isOperator())) notFound();

  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  const perOrg = await Promise.all(
    orgs.map((o) =>
      withTenant(o.id, (tx) =>
        tx.supportTicket.findMany({
          include: { user: { select: { name: true, email: true } } },
        }),
      )
        .then((tickets) => tickets.map((t) => ({ ...t, orgName: o.name })))
        .catch(() => []),
    ),
  );
  const tickets = perOrg
    .flat()
    .sort(
      (a, b) =>
        (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) ||
        b.updatedAt.getTime() - a.updatedAt.getTime(),
    );

  const openCount = tickets.filter((t) => t.status !== "CLOSED").length;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-xl font-semibold">Support tickets</h1>
        <p className="text-sm text-stone-500">
          {openCount === 0 ? "Nothing open." : `${openCount} open across every workspace.`}
        </p>
      </div>

      {tickets.length === 0 ? (
        <p className="text-sm text-stone-400">No tickets filed yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/tickets/${t.id}?tenant=${t.tenantId}`}
                className={`flex flex-wrap items-center gap-3 ${card} transition hover:border-stone-300`}
              >
                <TicketBadge status={t.status} />
                <span className="font-medium">{t.subject}</span>
                <span className="text-xs text-stone-400">
                  {t.orgName} · {t.user?.email} · {fmtDate(t.createdAt)}
                  {t.pagePath ? ` · ${t.pagePath}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-stone-400">
        <Link href="/admin" className="hover:underline">
          ← Operator panel
        </Link>
      </p>
    </main>
  );
}
