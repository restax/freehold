import { TransactionSide, TransactionStatus, withTenant } from "@freehold/db";
import Link from "next/link";
import { StatusBadge } from "@/components/badges";
import { ContractUploadForm } from "@/components/contract-upload-form";
import { EmptyState } from "@/components/empty-state";
import { createFromContract } from "@/lib/actions/extractions";
import { createTransaction } from "@/lib/actions/transactions";
import { fmtDate, fmtMoney, STATUS_LABEL } from "@/lib/format";
import { licenseGap, requiredStates } from "@/lib/licensing";
import { creditBalance, getTenantPlan, isCloud, transactionLimit } from "@/lib/plans";
import { sideLabel, tenantSideLabels } from "@/lib/side-labels";
import { requireTenant } from "@/lib/tenant";
import {
  btn,
  btnGhost,
  card,
  input,
  label,
  summaryLink,
  tableWrap,
  td,
  th,
  trHover,
} from "@/lib/ui";

export const dynamic = "force-dynamic";
// Contract extraction runs synchronously in the createFromContract server
// action (invoked from this route), and a real contract can take ~30–90s.
// Give it the full Hobby function budget so production never kills it mid-run.
export const maxDuration = 60;

const STATUSES = Object.values(TransactionStatus);
const SIDES = Object.values(TransactionSide);

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; mine?: string; licenseError?: string }>;
}) {
  const { tenantId, userId, isGuest } = await requireTenant({ allowGuest: true });
  const labels = await tenantSideLabels(tenantId);
  const [limit, plan, credits] = await Promise.all([
    transactionLimit(tenantId),
    getTenantPlan(tenantId),
    creditBalance(tenantId),
  ]);
  // Upload-first extraction opts a new transaction into pro AI, which a Free
  // workspace pays for with one credit.
  const needsCredit = isCloud() && plan.tier === "FREE";
  const outOfCredits = needsCredit && credits < 1;
  // Upload-first needs the AI: always on Cloud (platform key), opt-in on
  // self-host. Without a key, extraction can't run, so we hide the card
  // rather than leave a stranded provisional transaction behind a failure.
  const aiAvailable = Boolean(process.env.ANTHROPIC_API_KEY);
  const { status, mine, licenseError } = await searchParams;
  const statusFilter = STATUSES.includes(status as TransactionStatus)
    ? (status as TransactionStatus)
    : undefined;
  const mineFilter = mine === "1";

  const { transactions, clients, requiredStateSet, allLicenses } = await withTenant(
    tenantId,
    async (tx) => ({
      transactions: await tx.transaction.findMany({
        where: {
          ...(statusFilter ? { status: statusFilter } : {}),
          // A guest is outside coverage staff: they see only what they were
          // handed, whatever the filters say.
          ...(mineFilter || isGuest ? { assignees: { some: { userId } } } : {}),
        },
        orderBy: { updatedAt: "desc" },
        include: {
          client: { select: { name: true } },
          _count: { select: { tasks: true } },
          parties: {
            where: { role: { in: ["BUYER", "SELLER"] } },
            include: { contact: { select: { name: true } } },
          },
          assignees: { select: { userId: true } },
        },
      }),
      clients: await tx.client.findMany({ orderBy: { name: "asc" } }),
      requiredStateSet: await requiredStates(tx),
      // Every license in the workspace; the per-row check is a set lookup.
      allLicenses: await tx.userLicense.findMany({
        select: { userId: true, state: true, expiresAt: true },
      }),
    }),
  );
  const { prisma } = await import("@freehold/db");
  const members = await prisma.member.findMany({
    where: { organizationId: tenantId },
    include: { user: { select: { id: true, name: true } } },
  });
  const todayMs = Date.now();

  const licensesByUser = new Map<string, typeof allLicenses>();
  for (const lic of allLicenses) {
    const list = licensesByUser.get(lic.userId) ?? [];
    list.push(lic);
    licensesByUser.set(lic.userId, list);
  }
  /** Flag files sitting in a license-required state with nobody licensed. */
  const gapFor = (t: (typeof transactions)[number]) =>
    licenseGap({
      state: t.state,
      requiredStates: requiredStateSet,
      assigneeLicenses: t.assignees.flatMap((a) => licensesByUser.get(a.userId) ?? []),
    });

  return (
    <div className="flex flex-col gap-4">
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
          <label className="flex items-center gap-1.5 text-sm text-stone-600">
            <input
              type="checkbox"
              name="mine"
              value="1"
              defaultChecked={mineFilter}
              className="accent-brand-600"
            />
            Assigned to me
          </label>
          <button type="submit" className={btnGhost}>
            Filter
          </button>
        </form>
      </div>

      {licenseError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          Not created — {licenseError}
        </p>
      )}

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

      {aiAvailable &&
        !limit.limited &&
        (outOfCredits ? (
          <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600">
            You're out of AI credits.{" "}
            <Link href="/dashboard/billing" className="font-medium text-brand-700 underline">
              Buy more
            </Link>{" "}
            to start from a contract, or enter a transaction manually below.
          </p>
        ) : (
          <section className={`${card} border-brand-600/25 bg-brand-50/40`}>
            <h2 className="font-medium text-stone-900">Start from a contract</h2>
            <p className="mt-1 text-sm text-stone-600">
              Drop in the signed PDF — the AI reads the parties, price, and every deadline, each one
              page-cited and confidence-scored. You confirm before anything is saved. No typing.
            </p>
            <ContractUploadForm action={createFromContract} />
            <p className="mt-2 text-xs text-stone-400">
              PDF, up to 10&nbsp;MB. Extraction takes ~30–90 seconds.
              {needsCredit && ` Uses 1 of your ${credits} AI credit${credits === 1 ? "" : "s"}.`}
            </p>
          </section>
        ))}

      <details className={card}>
        <summary className={summaryLink}>
          {aiAvailable ? "Or enter details manually" : "New transaction"}
        </summary>
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
                  {sideLabel(s, labels)}
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
            Assign to
            <select name="assigneeId" className={input} defaultValue="">
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
              hint={
                aiAvailable
                  ? "Drop a signed contract above and the AI builds the file for you — parties, price, and every deadline, page-cited for you to confirm. Or enter one manually."
                  : 'Open "New transaction" above to add your first deal — attach the people, apply an action plan, and every deadline computes itself.'
              }
            />
          )
        ) : (
          <div className={tableWrap}>
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
                      {gapFor(t) && (
                        <span
                          title={`${t.state} requires a licensed coordinator on this file`}
                          className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900"
                        >
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          unlicensed
                        </span>
                      )}
                    </td>
                    <td className={td}>{sideLabel(t.side, labels)}</td>
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
          </div>
        )}
      </section>
    </div>
  );
}
