import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDate } from "@/lib/format";
import { isOperator } from "@/lib/operator";
import { PLAN_INFO } from "@/lib/plans";
import { card, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

/**
 * Operator panel: every workspace on this deployment, read-only. Org and
 * member tables carry no RLS (they're cross-tenant by design); per-tenant
 * usage counts run through the tenant-scoped path like everything else.
 */
export default async function AdminPage() {
  if (!(await isOperator())) notFound();

  const [orgs, userCount, recentUsers] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    }),
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { email: true, name: true, createdAt: true },
    }),
  ]);

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const signups7d = await prisma.user.count({ where: { createdAt: { gte: weekAgo } } });

  const activeCounts = await Promise.all(
    orgs.map((o) =>
      withTenant(o.id, (tx) =>
        tx.transaction.count({ where: { status: { notIn: ["CLOSED", "CANCELLED"] } } }),
      ).catch(() => 0),
    ),
  );

  const paying = orgs.filter((o) => o.planTier !== "FREE" && o.stripeSubscriptionId);
  const mrr = paying.reduce((sum, o) => sum + (PLAN_INFO[o.planTier].priceMonthly ?? 0), 0);

  const stats: Array<[string, string]> = [
    ["Workspaces", String(orgs.length)],
    ["Paying", String(paying.length)],
    ["MRR", `$${mrr}`],
    ["Users", String(userCount)],
    ["Signups, 7 days", String(signups7d)],
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-xl font-semibold">Operator panel</h1>
        <p className="text-sm text-stone-500">
          Every workspace on this deployment, read-only. Visible only to platform admins.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.map(([labelText, value]) => (
          <div key={labelText} className={card}>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-stone-500">{labelText}</p>
          </div>
        ))}
      </div>

      <section className={card}>
        <h2 className="mb-3 font-medium">Workspaces</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Plan</th>
                <th className={th}>Seats</th>
                <th className={th}>Active txns</th>
                <th className={th}>AI used</th>
                <th className={th}>Created</th>
                <th className={th}>Stripe</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o, i) => (
                <tr key={o.id} className={trHover}>
                  <td className={td}>
                    {o.name} <span className="text-xs text-stone-400">/{o.slug}</span>
                  </td>
                  <td className={td}>{PLAN_INFO[o.planTier].label}</td>
                  <td className={td}>
                    {o._count.members} / {o.seatLimit}
                  </td>
                  <td className={td}>
                    {activeCounts[i]}
                    {PLAN_INFO[o.planTier].activeTransactionLimit != null
                      ? ` / ${PLAN_INFO[o.planTier].activeTransactionLimit}`
                      : ""}
                  </td>
                  <td className={td}>{o.aiExtractionsUsed}</td>
                  <td className={td}>{fmtDate(o.createdAt)}</td>
                  <td className={td}>
                    {o.stripeCustomerId ? (
                      <a
                        href={`https://dashboard.stripe.com/test/customers/${o.stripeCustomerId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-700 hover:underline"
                      >
                        customer
                      </a>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-3 font-medium">Recent signups</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {recentUsers.map((u) => (
            <li key={u.email} className="flex justify-between gap-4">
              <span>
                {u.name} <span className="text-stone-400">{u.email}</span>
              </span>
              <span className="tabular-nums text-stone-500">{fmtDate(u.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-stone-400">
        <Link href="/dashboard" className="hover:underline">
          ← Back to the app
        </Link>
      </p>
    </main>
  );
}
