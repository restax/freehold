import { prisma, withTenant } from "@freehold/db";
import { billingEnabled, listPromotionCodes, subscriptionMetrics } from "@freehold/ee-billing";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adminApplyCoupon,
  adminCreateCompCode,
  adminCreateCoupon,
  adminGrantComp,
  adminRevokeComp,
  adminUnlockWorkspace,
} from "@/lib/actions/admin";
import { fmtDate } from "@/lib/format";
import { isOperator } from "@/lib/operator";
import { PLAN_INFO } from "@/lib/plans";
import { btn, btnGhost, card, input, label as labelCls, td, th, trHover } from "@/lib/ui";

/** Stripe subscription statuses that mean money didn't come in. */
const PROBLEM_STATUSES = new Set(["past_due", "unpaid"]);
const STRIPE_BASE = "https://dashboard.stripe.com";

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

  const [metrics, promoCodes, carts, trialSignups30d, compCodes] = await Promise.all([
    billingEnabled() ? subscriptionMetrics(30).catch(() => null) : Promise.resolve(null),
    billingEnabled() ? listPromotionCodes().catch(() => []) : Promise.resolve([]),
    prisma.checkoutAttempt.findMany({
      where: { completedAt: null },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.organization.count({
      where: { planTier: "FREE", createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
    }),
    prisma.compCode.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  // Workspaces that need attention: locked for nonpayment, or Stripe reports past_due/unpaid.
  const paymentProblems = orgs.filter(
    (o) => o.billingSuspendedAt || PROBLEM_STATUSES.has(o.subscriptionStatus ?? ""),
  );

  const activeCounts = await Promise.all(
    orgs.map((o) =>
      withTenant(o.id, (tx) =>
        tx.transaction.count({ where: { status: { notIn: ["CLOSED", "CANCELLED"] } } }),
      ).catch(() => 0),
    ),
  );

  const openTicketCounts = await Promise.all(
    orgs.map((o) =>
      withTenant(o.id, (tx) =>
        tx.supportTicket.count({ where: { status: { not: "CLOSED" } } }),
      ).catch(() => 0),
    ),
  );
  const openTickets = openTicketCounts.reduce((sum, n) => sum + n, 0);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Operator panel</h1>
          <p className="text-sm text-stone-500">
            Every workspace on this deployment, read-only. Visible only to platform admins.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/inbound" className={btnGhost}>
            Unmatched inbound
          </Link>
          <Link
            href="/admin/tickets"
            className={`${btnGhost} ${openTickets > 0 ? "border-brand-300 text-brand-700" : ""}`}
          >
            Support tickets{openTickets > 0 ? ` — ${openTickets} open` : ""}
          </Link>
        </div>
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
                <th className={th}>Coupon</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o, i) => (
                <tr key={o.id} className={trHover}>
                  <td className={td}>
                    {o.name} <span className="text-xs text-stone-400">/{o.slug}</span>
                  </td>
                  <td className={td}>
                    {o.compTier ? (
                      <span className="text-brand-700">{PLAN_INFO[o.compTier].label} · comp</span>
                    ) : (
                      PLAN_INFO[o.planTier].label
                    )}
                    {o.billingSuspendedAt && (
                      <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-700">
                        locked
                      </span>
                    )}
                  </td>
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
                        href={`${STRIPE_BASE}/customers/${o.stripeCustomerId}`}
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
                  <td className={td}>
                    {o.stripeSubscriptionId ? (
                      <form action={adminApplyCoupon} className="flex items-center gap-1.5">
                        <input type="hidden" name="tenantId" value={o.id} />
                        <input
                          name="code"
                          placeholder="CODE"
                          className="w-24 rounded border border-stone-300 px-1.5 py-0.5 font-mono text-xs uppercase focus:border-brand-600 focus:outline-none"
                        />
                        <button type="submit" className={`${btnGhost} px-2 py-0.5 text-xs`}>
                          Apply
                        </button>
                      </form>
                    ) : o.compTier ? (
                      <form action={adminRevokeComp}>
                        <input type="hidden" name="tenantId" value={o.id} />
                        <button type="submit" className={`${btnGhost} px-2 py-0.5 text-xs`}>
                          Revoke comp
                        </button>
                      </form>
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
        <h2 className="mb-1 font-medium">Payment problems</h2>
        <p className="mb-3 text-xs text-stone-400">
          Failed renewals. These workspaces are locked (data kept, never deleted) until payment is
          fixed. Work with the client, then unlock — or comp them to keep them running while you
          sort it out. Wipe the balance itself in Stripe (mark the invoice uncollectible or void).
        </p>
        {paymentProblems.length === 0 ? (
          <p className="text-sm text-stone-400">None — every subscription is current.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {paymentProblems.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200/70 bg-amber-50/40 px-3 py-2"
              >
                <span className="font-medium">{o.name}</span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                  {o.subscriptionStatus ?? "locked"}
                </span>
                {o.stripeSubscriptionId && (
                  <a
                    href={`${STRIPE_BASE}/subscriptions/${o.stripeSubscriptionId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-700 hover:underline"
                  >
                    Stripe subscription →
                  </a>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  {o.billingSuspendedAt && (
                    <form action={adminUnlockWorkspace}>
                      <input type="hidden" name="tenantId" value={o.id} />
                      <button type="submit" className={`${btnGhost} px-2 py-0.5 text-xs`}>
                        Unlock
                      </button>
                    </form>
                  )}
                  <form action={adminGrantComp} className="flex items-center gap-1">
                    <input type="hidden" name="tenantId" value={o.id} />
                    <select
                      name="tier"
                      defaultValue="PRO"
                      className="rounded border border-stone-300 px-1 py-0.5 text-xs"
                    >
                      <option value="PRO">Pro</option>
                      <option value="BUSINESS">Business</option>
                    </select>
                    <button type="submit" className={`${btnGhost} px-2 py-0.5 text-xs`}>
                      Comp
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-1 font-medium">Analytics — last 30 days</h2>
        <p className="mb-3 text-xs text-stone-400">
          Subscription numbers straight from Stripe. Website visitors live in Vercel Analytics
          (project → Analytics tab) and PostHog once enabled — no numbers shown here until then.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              ["New subscriptions", metrics ? String(metrics.newSubscriptions) : "—"],
              ["Cancellations", metrics ? String(metrics.cancellations) : "—"],
              ["In free trial now", metrics ? String(metrics.trialing) : "—"],
              ["Free-tier signups", String(trialSignups30d)],
            ] as Array<[string, string]>
          ).map(([labelText, value]) => (
            <div key={labelText} className="rounded-xl border border-stone-200/70 p-4">
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-stone-500">{labelText}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-medium">Coupons</h2>
        <p className="mb-3 text-xs text-stone-400">
          Codes work at checkout (customers type them) and can be applied to a workspace's active
          subscription below — discounts hit upcoming months.
        </p>
        <form action={adminCreateCoupon} className="mb-4 flex flex-wrap items-end gap-3">
          <label className={labelCls}>
            Code
            <input
              name="code"
              required
              placeholder="WELCOME10"
              className={`${input} w-36 uppercase`}
            />
          </label>
          <label className={labelCls}>
            Type
            <select name="kind" className={input} defaultValue="amount">
              <option value="amount">$ off per month</option>
              <option value="free">Free plan</option>
            </select>
          </label>
          <label className={labelCls}>
            $ off
            <input name="amount" inputMode="decimal" placeholder="10" className={`${input} w-20`} />
          </label>
          <label className={labelCls}>
            Months
            <input
              name="months"
              inputMode="numeric"
              defaultValue="3"
              required
              className={`${input} w-20`}
            />
          </label>
          <label className={labelCls}>
            Uses
            <select name="usage" className={input} defaultValue="multi">
              <option value="multi">Multi-use (unlimited)</option>
              <option value="single">Single-use (one redemption total)</option>
            </select>
          </label>
          <label className={labelCls}>
            Expires (optional)
            <input name="expiresAt" type="date" className={`${input} w-40`} />
          </label>
          <button type="submit" className={btn}>
            Create coupon
          </button>
        </form>
        {promoCodes.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {promoCodes.map((c) => (
              <li key={c.code} className="flex flex-wrap gap-3">
                <code className="font-mono font-semibold">{c.code}</code>
                <span className="text-stone-500">{c.name}</span>
                <span className="text-xs text-stone-400">
                  {c.redemptions}
                  {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""} redemptions
                  {c.maxRedemptions === 1 ? " · single-use" : ""}
                  {c.active ? "" : " · inactive"}
                  {c.expiresAt ? ` · expires ${fmtDate(new Date(c.expiresAt * 1000))}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-1 font-medium">Complimentary plans (comp codes)</h2>
        <p className="mb-3 text-xs text-stone-400">
          A comp code grants a full plan with <strong>no Stripe checkout and no charge</strong>.
          Give the code to a workspace; they redeem it on their billing page. Leave duration blank
          for an open-ended comp (revoke any time from the Workspaces table).
        </p>
        <form action={adminCreateCompCode} className="mb-4 flex flex-wrap items-end gap-3">
          <label className={labelCls}>
            Code (blank = auto)
            <input name="code" placeholder="auto-generated" className={`${input} w-44 uppercase`} />
          </label>
          <label className={labelCls}>
            Plan
            <select name="tier" className={input} defaultValue="PRO">
              <option value="PRO">Pro</option>
              <option value="BUSINESS">Business</option>
            </select>
          </label>
          <label className={labelCls}>
            Lasts (months)
            <input
              name="durationMonths"
              inputMode="numeric"
              placeholder="∞"
              className={`${input} w-24`}
            />
          </label>
          <label className={labelCls}>
            Max uses
            <input
              name="maxRedemptions"
              inputMode="numeric"
              defaultValue="1"
              className={`${input} w-20`}
            />
          </label>
          <label className={labelCls}>
            Code expires (optional)
            <input name="expiresAt" type="date" className={`${input} w-40`} />
          </label>
          <label className={labelCls}>
            Note
            <input name="note" placeholder="who / why" className={`${input} w-44`} />
          </label>
          <button type="submit" className={btn}>
            Create comp code
          </button>
        </form>
        {compCodes.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {compCodes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3">
                <code className="font-mono font-semibold">{c.code}</code>
                <span className="text-stone-500">{PLAN_INFO[c.tier].label}</span>
                <span className="text-xs text-stone-400">
                  {c.durationMonths ? `${c.durationMonths} mo` : "no expiry"} · {c.timesRedeemed}/
                  {c.maxRedemptions} used
                  {c.expiresAt ? ` · code expires ${fmtDate(c.expiresAt)}` : ""}
                  {c.note ? ` · ${c.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-1 font-medium">Abandoned checkouts</h2>
        <p className="mb-3 text-xs text-stone-400">
          Started checkout but never paid. Email them yourself, or send the Stripe recovery link
          when one exists (expired sessions keep a revival URL for 30 days).
        </p>
        {carts.length === 0 ? (
          <p className="text-sm text-stone-400">None — everyone who started checkout finished.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {carts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3">
                <a
                  href={`mailto:${c.email}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {c.email}
                </a>
                <span className="text-stone-500">{c.tier}</span>
                <span className="text-xs text-stone-400">{fmtDate(c.createdAt)}</span>
                {c.expiredAt ? (
                  c.recoveryUrl ? (
                    <a
                      href={c.recoveryUrl}
                      className="text-xs text-brand-700 underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      recovery link
                    </a>
                  ) : (
                    <span className="text-xs text-stone-400">expired</span>
                  )
                ) : (
                  <span className="text-xs text-amber-600">open</span>
                )}
              </li>
            ))}
          </ul>
        )}
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
