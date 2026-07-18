import { TaskStatus, TransactionStatus, withTenant } from "@freehold/db";
import Link from "next/link";
import { StatusBadge, statusDot } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { HubNews } from "@/components/hub-news";
import { toggleTask } from "@/lib/actions/tasks";
import { fmtDate, STATUS_LABEL } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { card, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const PIPELINE: TransactionStatus[] = [
  TransactionStatus.LISTING,
  TransactionStatus.UNDER_CONTRACT,
  TransactionStatus.PENDING,
  TransactionStatus.CLOSED,
];

export default async function DashboardPage() {
  const { tenantId } = await requireTenant();
  const soon = new Date();
  soon.setUTCDate(soon.getUTCDate() + 14);

  const { counts, upcoming, recent } = await withTenant(tenantId, async (tx) => ({
    counts: await tx.transaction.groupBy({ by: ["status"], _count: { _all: true } }),
    upcoming: await tx.task.findMany({
      where: { status: TaskStatus.OPEN, dueDate: { lte: soon } },
      orderBy: { dueDate: "asc" },
      take: 12,
      include: { transaction: { select: { id: true, propertyAddress: true } } },
    }),
    recent: await tx.transaction.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { client: { select: { name: true } } },
    }),
  }));

  const countFor = (s: TransactionStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const today = fmtDate(new Date());

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-stone-200/70 bg-white shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)] sm:grid-cols-4">
        {PIPELINE.map((s, i) => (
          <Link
            key={s}
            href={`/dashboard/transactions?status=${s}`}
            className={`flex flex-col gap-1 border-stone-100 px-5 pb-4 pt-5 transition-colors hover:bg-stone-50 ${
              [
                "border-b border-r sm:border-b-0",
                "border-b sm:border-b-0 sm:border-r",
                "border-r",
                "",
              ][i]
            }`}
          >
            <span className="font-serif text-3xl font-semibold tabular-nums leading-none">
              {countFor(s)}
            </span>
            <span className="mt-1 flex items-center gap-1.5 text-sm text-stone-500">
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${statusDot(s)}`} />
              {STATUS_LABEL[s]}
            </span>
          </Link>
        ))}
      </div>

      <section className={card}>
        <h2 className="mb-3 font-medium">Tasks due soon</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing due in the next 14 days.</p>
        ) : (
          <ul className="flex flex-col">
            {upcoming.map((t) => {
              const overdue = t.dueDate && fmtDate(t.dueDate) < today;
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 border-b border-stone-100 py-2 last:border-0"
                >
                  <form action={toggleTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="transactionId" value={t.transactionId ?? ""} />
                    <button
                      type="submit"
                      title="Mark done"
                      className="h-5 w-5 rounded border border-stone-300 hover:border-brand-600"
                    />
                  </form>
                  <span
                    className={`whitespace-nowrap text-sm tabular-nums ${overdue ? "font-medium text-red-600" : "text-stone-500"}`}
                  >
                    {fmtDate(t.dueDate)}
                  </span>
                  <span className="text-sm">{t.title}</span>
                  {t.transaction && (
                    <Link
                      href={`/dashboard/transactions/${t.transaction.id}`}
                      className="ml-auto truncate text-sm text-brand-600 hover:underline"
                    >
                      {t.transaction.propertyAddress}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-3 font-medium">Recent transactions</h2>
        {recent.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            hint="Create your first transaction and Freehold will track its dates, tasks, people, and paperwork in one place."
          >
            <Link
              href="/dashboard/transactions"
              className="text-sm font-medium text-brand-700 hover:text-brand-600"
            >
              Create a transaction →
            </Link>
          </EmptyState>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Property</th>
                <th className={th}>Client</th>
                <th className={th}>Status</th>
                <th className={th}>Close date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id} className={trHover}>
                  <td className={td}>
                    <Link
                      href={`/dashboard/transactions/${t.id}`}
                      className="font-medium text-brand-700 hover:text-brand-600"
                    >
                      {t.propertyAddress}
                    </Link>
                  </td>
                  <td className={td}>{t.client?.name ?? "—"}</td>
                  <td className={td}>
                    <StatusBadge status={t.status} />
                  </td>
                  <td className={td}>{fmtDate(t.closeDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <HubNews />
    </div>
  );
}
