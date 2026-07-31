import { TransactionStatus, withTenant } from "@freehold/db";
import Link from "next/link";
import { StatusBadge } from "@/components/badges";
import { ColumnPicker } from "@/components/column-picker";
import { EmptyState } from "@/components/empty-state";
import { MultiSelect } from "@/components/multi-select";
import { SideBadge } from "@/components/side-badge";
import { saveTransactionColumns } from "@/lib/actions/table-prefs";
import { fmtDate, fmtMoney, STATUS_LABEL } from "@/lib/format";
import { licenseGap, requiredStates } from "@/lib/licensing";
import { creditBalance, getTenantPlan, isCloud, transactionLimit } from "@/lib/plans";
import { type SideLabels, sideLabel, tenantSideLabels } from "@/lib/side-labels";
import { requireTenant } from "@/lib/tenant";
import {
  columnGroups,
  resolveColumns,
  TRANSACTION_COLUMNS,
  tableMinWidth,
} from "@/lib/transaction-columns";
import {
  closingSoonWindow,
  hasActiveFilters,
  isViewKey,
  multiParam,
  searchTerm,
  startOfYear,
  TRANSACTION_VIEWS,
  type TransactionFilters,
  viewShape,
} from "@/lib/transaction-views";
import { btn, btnGhost, card, input, tableFixed, tableWrap, tdFixed, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";
// Contract extraction runs synchronously in the createFromContract server
// action (invoked from this route), and a real contract can take ~30–90s.
// Give it the full Hobby function budget so production never kills it mid-run.
export const maxDuration = 60;

const STATUSES = Object.values(TransactionStatus);

/** The row shape the table renders — inferred from the query below. */
type Row = {
  id: string;
  propertyAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string;
  side: string;
  mlsId: string | null;
  purchasePrice: number | null;
  listPrice: number | null;
  contractDate: Date | null;
  closeDate: Date | null;
  listDate: Date | null;
  onMarketDate: Date | null;
  mortgageCommitmentDate: Date | null;
  inspectionDeadlineDate: Date | null;
  updatedAt: Date;
  client: { name: string } | null;
  parties: Array<{ contact: { name: string } }>;
  tasks: Array<{ id: string }>;
  assignees: Array<{ user: { name: string } }>;
  _count: { tasks: number; documents: number };
};

/** Days on market: from listing to close, or to today while it's still live. */
function domOf(t: Row, todayMs: number): string {
  const start = t.onMarketDate ?? t.listDate;
  if (!start) return "—";
  const end =
    t.status === "CLOSED" || t.status === "CANCELLED"
      ? (t.closeDate?.getTime() ?? t.updatedAt.getTime())
      : todayMs;
  return String(Math.max(0, Math.round((end - start.getTime()) / 86400000)));
}

/** The soonest date still ahead of the file — what a coordinator chases next. */
function nextKeyDate(t: Row): string {
  const candidates: Array<[string, Date | null]> = [
    ["Inspection", t.inspectionDeadlineDate],
    ["Mortgage", t.mortgageCommitmentDate],
    ["Closing", t.closeDate],
  ];
  const upcoming = candidates
    .filter((c): c is [string, Date] => c[1] !== null)
    .sort((a, b) => a[1].getTime() - b[1].getTime());
  const next = upcoming[0];
  return next ? `${next[0]} ${fmtDate(next[1])}` : "—";
}

const partyNames = (t: Row) => t.parties.map((p) => p.contact.name).join(", ");
const coordinatorNames = (t: Row) => t.assignees.map((a) => a.user.name).join(", ");

/** Tooltip for cells that truncate, so a clipped value is still readable. */
function cellTitle(t: Row, key: string, labels: SideLabels): string | undefined {
  switch (key) {
    case "address":
      return t.propertyAddress;
    case "buyersSellers":
      return partyNames(t) || undefined;
    case "coordinators":
      return coordinatorNames(t) || undefined;
    case "client":
      return t.client?.name;
    case "side":
      return sideLabel(t.side, labels);
    default:
      return undefined;
  }
}

function renderCell(
  t: Row,
  key: string,
  ctx: { labels: SideLabels; todayMs: number; unlicensed: boolean },
): React.ReactNode {
  switch (key) {
    case "address":
      return (
        <>
          {/* The side rides with the address so it survives the column
              picker — hiding the Side column shouldn't hide which side
              of the deal the file is worked from. */}
          <SideBadge side={t.side} labels={ctx.labels} />
          <Link
            href={`/dashboard/transactions/${t.id}`}
            className="ml-1.5 font-medium text-brand-700 hover:text-brand-600"
          >
            {t.propertyAddress}
          </Link>
          {ctx.unlicensed && (
            <span
              title={`${t.state} requires a licensed coordinator on this file`}
              className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900"
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              unlicensed
            </span>
          )}
        </>
      );
    case "city":
      return t.city ?? "—";
    case "state":
      return t.state ?? "—";
    case "zip":
      return t.zip ?? "—";
    case "status":
      return <StatusBadge status={t.status} />;
    case "side":
      return sideLabel(t.side, ctx.labels);
    case "buyersSellers":
      return partyNames(t) || "—";
    case "client":
      return t.client?.name ?? "—";
    case "price":
      return fmtMoney(t.purchasePrice ?? t.listPrice);
    case "listPrice":
      return fmtMoney(t.listPrice);
    case "contractPrice":
      return fmtMoney(t.purchasePrice);
    case "mlsId":
      return t.mlsId ?? "—";
    case "contractDate":
      return fmtDate(t.contractDate);
    case "closeDate":
      return fmtDate(t.closeDate);
    case "nextDate":
      return nextKeyDate(t);
    case "dom":
      return domOf(t, ctx.todayMs);
    case "tasks":
      // Open over total: "3/12" reads faster than either number alone.
      return t._count.tasks === 0 ? "—" : `${t.tasks.length}/${t._count.tasks}`;
    case "documents":
      return t._count.documents === 0 ? "—" : String(t._count.documents);
    case "coordinators":
      return coordinatorNames(t) || "—";
    default:
      return "—";
  }
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    q?: string;
    status?: string | string[];
    assignee?: string | string[];
    client?: string | string[];
    mine?: string;
    licenseError?: string;
  }>;
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
  const params = await searchParams;
  const { licenseError } = params;

  const view = isViewKey(params.view) ? params.view : "all";
  const shape = viewShape(view);
  const filters: TransactionFilters = {
    view,
    q: searchTerm(params.q),
    statuses: multiParam(params.status, STATUSES),
    assigneeIds: multiParam(params.assignee),
    clientIds: multiParam(params.client),
  };
  // The old ?mine=1 link still works; it just reads as another way to say
  // "scope this to me" on top of whatever view is selected.
  const mineOnly = shape.mineOnly || params.mine === "1";
  // Explicit status filters win over the view's defaults — a view is a
  // starting point, not a cage.
  const statusesInPlay = filters.statuses.length > 0 ? filters.statuses : [...shape.statuses];
  const now = new Date();

  const { transactions, clients, requiredStateSet, allLicenses } = await withTenant(
    tenantId,
    async (tx) => ({
      transactions: await tx.transaction.findMany({
        where: {
          ...(statusesInPlay.length > 0
            ? { status: { in: statusesInPlay as TransactionStatus[] } }
            : {}),
          // A guest is outside coverage staff: they see only what they were
          // handed, whatever the filters say.
          ...(mineOnly || isGuest ? { assignees: { some: { userId } } } : {}),
          ...(filters.assigneeIds.length > 0
            ? { assignees: { some: { userId: { in: filters.assigneeIds } } } }
            : {}),
          ...(filters.clientIds.length > 0 ? { clientId: { in: filters.clientIds } } : {}),
          ...(shape.closingSoon ? { closeDate: closingSoonWindow(now) } : {}),
          ...(shape.closedThisYear ? { closeDate: { gte: startOfYear(now) } } : {}),
          ...(shape.hasOpenTasks ? { tasks: { some: { status: { not: "DONE" } } } } : {}),
          // Address or anyone named on the file — what a coordinator
          // actually remembers about a deal.
          ...(filters.q
            ? {
                OR: [
                  { propertyAddress: { contains: filters.q, mode: "insensitive" as const } },
                  { city: { contains: filters.q, mode: "insensitive" as const } },
                  { mlsId: { contains: filters.q, mode: "insensitive" as const } },
                  { client: { name: { contains: filters.q, mode: "insensitive" as const } } },
                  {
                    parties: {
                      some: {
                        contact: {
                          name: { contains: filters.q, mode: "insensitive" as const },
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        include: {
          client: { select: { name: true } },
          _count: { select: { tasks: true, documents: true } },
          parties: {
            where: { role: { in: ["BUYER", "SELLER"] } },
            include: { contact: { select: { name: true } } },
          },
          // Open-task count per file, for the Tasks column.
          tasks: { where: { status: { not: "DONE" } }, select: { id: true } },
          assignees: { select: { userId: true, user: { select: { name: true } } } },
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
  const filtersActive = hasActiveFilters(filters);

  // This person's own column layout for this workspace; unset falls back to
  // the defaults in lib/transaction-columns.ts.
  const me = members.find((m) => m.userId === userId);
  const storedColumns = (me?.tablePrefs as { transactionColumns?: unknown } | null)
    ?.transactionColumns;
  const columns = resolveColumns(storedColumns);
  const columnKeys = columns.map((c) => c.key);

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
      {/* Title left, the way into a new file on the right. Creation is its
          own page — this one's job is reading the pipeline, and a create form
          folded into the toolbar left "+ Create → Transaction" landing here
          with nothing visibly open. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold">Transactions</h1>
          <span className="text-sm text-stone-500">
            {transactions.length} {transactions.length === 1 ? "file" : "files"}
            {filtersActive || view !== "all" ? " matching" : ""}
          </span>
        </div>
        <Link href="/dashboard/transactions/new" className={btn}>
          New transaction
        </Link>
      </div>

      {/* Saved views: the handful of questions a coordinator asks daily, one
          click each, rather than re-deriving them from dropdowns. */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-stone-200">
        {TRANSACTION_VIEWS.map((v) => {
          const active = v.key === view;
          return (
            <Link
              key={v.key}
              href={v.key === "all" ? "/dashboard/transactions" : `?view=${v.key}`}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-brand-600 font-medium text-brand-800"
                  : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800"
              }`}
            >
              {v.label}
            </Link>
          );
        })}
      </div>

      {/* One toolbar row: find, narrow, and choose columns. Everything that
          acts on the list lives here so the table below owns the rest. */}
      <div className="flex flex-wrap items-center gap-2">
        <form className="flex min-w-64 flex-1 items-center gap-2">
          <input type="hidden" name="view" value={view} />
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search address, city, MLS ID, client or party name"
            aria-label="Search transactions"
            className={`${input} flex-1`}
          />
          <button type="submit" className={btnGhost}>
            Search
          </button>
        </form>
        <ColumnPicker
          action={saveTransactionColumns}
          all={[...TRANSACTION_COLUMNS]}
          groups={columnGroups()}
          selected={columnKeys}
        />
        {filtersActive && (
          <Link
            href={view === "all" ? "/dashboard/transactions" : `?view=${view}`}
            className="text-sm text-stone-500 hover:text-stone-800"
          >
            Clear filters
          </Link>
        )}
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

      {aiAvailable && !limit.limited && outOfCredits && (
        <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600">
          You're out of AI credits.{" "}
          <Link href="/dashboard/billing" className="font-medium text-brand-700 underline">
            Buy more
          </Link>{" "}
          to start from a contract, or use “New transaction” above.
        </p>
      )}

      {/* Filters beside the table, not stacked above it: a coordinator
          narrows the list and reads the result in one glance, instead of
          scrolling past a panel to see what it did. */}
      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <form className={`${card} flex flex-col gap-4`}>
          <input type="hidden" name="view" value={view} />
          {filters.q && <input type="hidden" name="q" value={filters.q} />}
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-stone-800">Filters</h2>
            {filtersActive && (
              <Link
                href={view === "all" ? "/dashboard/transactions" : `?view=${view}`}
                className="text-xs text-stone-500 hover:text-stone-800"
              >
                Clear
              </Link>
            )}
          </div>

          <MultiSelect
            name="status"
            label="Stage"
            placeholder="Any stage"
            defaultValue={filters.statuses}
            options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] ?? s }))}
          />

          <MultiSelect
            name="assignee"
            label="Team member"
            placeholder="Anyone"
            defaultValue={filters.assigneeIds}
            options={members.map((m) => ({ value: m.user.id, label: m.user.name }))}
          />

          <MultiSelect
            name="client"
            label="Client"
            placeholder="Any client"
            defaultValue={filters.clientIds}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />

          <button type="submit" className={btn}>
            Apply filters
          </button>
        </form>

        <section className={card}>
          {transactions.length === 0 ? (
            filtersActive || view !== "all" ? (
              <EmptyState
                title="Nothing matches"
                hint="No files fit this view and these filters. Widen the search, or clear it to see the whole pipeline."
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
              <table className={tableFixed} style={{ minWidth: tableMinWidth(columns) }}>
                {/* Explicit widths are what make the columns strict: every row
                  lands on the same grid instead of each one negotiating its
                  own. Long values truncate rather than widening a column. */}
                <colgroup>
                  {columns.map((c) => (
                    <col key={c.key} style={{ width: c.width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th
                        key={c.key}
                        className={`${th} ${c.align === "right" ? "text-right" : ""}`}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className={trHover}>
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={`${tdFixed} ${
                            c.align === "right" ? "text-right tabular-nums" : ""
                          }`}
                          title={cellTitle(t, c.key, labels)}
                        >
                          {renderCell(t, c.key, {
                            labels,
                            todayMs,
                            unlicensed: gapFor(t) !== null,
                          })}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
