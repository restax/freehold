import { TransactionSide, TransactionStatus, withTenant } from "@freehold/db";
import Link from "next/link";
import { StatusBadge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { createTransaction } from "@/lib/actions/transactions";
import { fmtDate, fmtMoney, SIDE_LABEL, STATUS_LABEL } from "@/lib/format";
import { transactionLimit } from "@/lib/plans";
import { requireTenant } from "@/lib/tenant";
import { btn, btnGhost, card, input, label, summaryLink, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const STATUSES = Object.values(TransactionStatus);
const SIDES = Object.values(TransactionSide);

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const limit = await transactionLimit(tenantId);
  const { status } = await searchParams;
  const statusFilter = STATUSES.includes(status as TransactionStatus)
    ? (status as TransactionStatus)
    : undefined;

  const { transactions, clients } = await withTenant(tenantId, async (tx) => ({
    transactions: await tx.transaction.findMany({
      where: statusFilter ? { status: statusFilter } : {},
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { name: true } },
        _count: { select: { tasks: true } },
        parties: {
          where: { role: { in: ["BUYER", "SELLER"] } },
          include: { contact: { select: { name: true } } },
        },
      },
    }),
    clients: await tx.client.findMany({ orderBy: { name: "asc" } }),
  }));
  const { prisma } = await import("@freehold/db");
  const members = await prisma.member.findMany({
    where: { organizationId: tenantId },
    include: { user: { select: { id: true, name: true } } },
  });
  const todayMs = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transactions</h1>
        <form className="flex items-center gap-2">
          <select name="status" defaultValue={statusFilter ?? ""} className={input}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button type="submit" className={btnGhost}>
            Filter
          </button>
        </form>
      </div>

      {limit.limit != null && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            limit.limited ? "bg-amber-50 text-amber-900" : "bg-stone-100 text-stone-600"
          }`}
        >
          {limit.active} of {limit.limit} active transactions on the Free plan.{" "}
          {limit.limited ? (
            <>
              You've reached the limit — existing transactions stay fully accessible;{" "}
              <Link href="/dashboard/billing" className="font-medium text-brand-700 underline">
                upgrade
              </Link>{" "}
              to create more (or close out finished deals).
            </>
          ) : (
            <Link href="/dashboard/billing" className="text-brand-700 underline">
              View plans
            </Link>
          )}
        </p>
      )}

      <details className={card}>
        <summary className={summaryLink}>New transaction</summary>
        <form action={createTransaction} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={`${label} sm:col-span-2`}>
            Property address *
            <input
              name="propertyAddress"
              required
              className={input}
              placeholder="412 Maple Avenue"
            />
          </label>
          <label className={label}>
            Client
            <select name="clientId" className={input} defaultValue="">
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            City
            <input name="city" className={input} />
          </label>
          <label className={label}>
            State
            <input name="state" className={input} maxLength={2} />
          </label>
          <label className={label}>
            ZIP
            <input name="zip" className={input} />
          </label>
          <label className={label}>
            Status
            <select name="status" className={input} defaultValue="UNDER_CONTRACT">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Side
            <select name="side" className={input} defaultValue="BUY_SIDE">
              {SIDES.map((s) => (
                <option key={s} value={s}>
                  {SIDE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Purchase price ($)
            <input name="purchasePrice" inputMode="numeric" className={input} />
          </label>
          <label className={label}>
            Contract date
            <input name="contractDate" type="date" className={input} />
          </label>
          <label className={label}>
            Close date
            <input name="closeDate" type="date" className={input} />
          </label>
          <label className={label}>
            List price ($)
            <input name="listPrice" inputMode="numeric" className={input} />
          </label>
          <label className={label}>
            List date
            <input name="listDate" type="date" className={input} />
          </label>
          <label className={label}>
            On-market date
            <input name="onMarketDate" type="date" className={input} />
          </label>
          <label className={label}>
            Expire date
            <input name="expireDate" type="date" className={input} />
          </label>
          <label className={label}>
            MLS ID
            <input name="mlsId" className={input} />
          </label>
          <label className={label}>
            Co-agent (managed agent)
            <select name="coAgentClientId" className={input} defaultValue="">
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            TC / assistant 1
            <select name="tc1UserId" className={input} defaultValue="">
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            TC / assistant 2
            <select name="tc2UserId" className={input} defaultValue="">
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" className={btn}>
              Create transaction
            </button>
          </div>
        </form>
      </details>

      <section className={card}>
        {transactions.length === 0 ? (
          statusFilter ? (
            <EmptyState
              title={`No ${STATUS_LABEL[statusFilter].toLowerCase()} transactions`}
              hint="Clear the filter to see everything, or move a deal into this stage from its detail page."
            >
              <Link
                href="/dashboard/transactions"
                className="text-sm font-medium text-brand-700 hover:text-brand-600"
              >
                Show all transactions →
              </Link>
            </EmptyState>
          ) : (
            <EmptyState
              title="Your pipeline is empty"
              hint='Open "New transaction" above to add your first deal — attach the people, apply an action plan, and every deadline computes itself.'
            />
          )
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Property</th>
                <th className={th}>Side</th>
                <th className={th}>Buyer / Seller</th>
                <th className={th}>Status</th>
                <th className={th}>Price</th>
                <th className={th}>Closing</th>
                <th className={th}>DOM</th>
                <th className={th}>MLS ID</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className={trHover}>
                  <td className={td}>
                    <Link
                      href={`/dashboard/transactions/${t.id}`}
                      className="font-medium text-brand-700 hover:text-brand-600"
                    >
                      {t.propertyAddress}
                    </Link>
                  </td>
                  <td className={td}>{SIDE_LABEL[t.side]}</td>
                  <td className={td}>{t.parties.map((p) => p.contact.name).join(", ") || "—"}</td>
                  <td className={td}>
                    <StatusBadge status={t.status} />
                  </td>
                  <td className={td}>{fmtMoney(t.purchasePrice ?? t.listPrice)}</td>
                  <td className={td}>{fmtDate(t.closeDate)}</td>
                  <td className={td}>
                    {(() => {
                      const start = t.onMarketDate ?? t.listDate;
                      if (!start) return "—";
                      const end =
                        t.status === "CLOSED" || t.status === "CANCELLED"
                          ? (t.closeDate?.getTime() ?? t.updatedAt.getTime())
                          : todayMs;
                      return Math.max(0, Math.round((end - start.getTime()) / 86400000));
                    })()}
                  </td>
                  <td className={td}>{t.mlsId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
