import { prisma, TaskStatus, TransactionStatus, withTenant } from "@freehold/db";
import { CalendarCheck, CheckCircle, Sun, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { after } from "next/server";
import { AddressPill } from "@/components/address-pill";
import { StatusBadge, statusDot } from "@/components/badges";
import { RangeSwitch, TopClientsChart, VolumeChart } from "@/components/dashboard-charts";
import { EmptyState } from "@/components/empty-state";
import { HandbookGlance } from "@/components/handbook-glance";
import { HubNews } from "@/components/hub-news";
import { SectionCard } from "@/components/section-card";
import { SideBadge } from "@/components/side-badge";
import { toggleTask } from "@/lib/actions/tasks";
import { activityTitle } from "@/lib/activity";
import { rankAlerts, transactionAlerts } from "@/lib/alerts";
import { billingExceptions, invoiceMoney, transactionBilling } from "@/lib/billing";
import { cloudPromptDue, cloudPromptText, readCloudPromptConfig } from "@/lib/cloud-prompt";
import { bucketByDay, parseRange, topClients } from "@/lib/dashboard-charts";
import { directoryNudgeDue, readDirectoryConfig } from "@/lib/directory";
import { fmtDate, fmtDayMonth, STATUS_LABEL } from "@/lib/format";
import { summaryNotesFor } from "@/lib/handbook";
import { isStale } from "@/lib/handbook/summary-context";
import { agingBucket } from "@/lib/invoicing";
import { fmtCents } from "@/lib/pay";
import { handbookState, isCloud } from "@/lib/plans";
import { getPlatformSettings } from "@/lib/platform-settings";
import {
  byPriorityThenDate,
  effectivePriority,
  PRIORITY_LABEL,
  priorityBadgeStyle,
  rowHighlightStyle,
} from "@/lib/priority";
import { tenantSideLabels } from "@/lib/side-labels";
import { getBillingAccess, getMemberRole, requireTenant } from "@/lib/tenant";
import { tableWrap, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

// The pipeline strip stays four columns wide on purpose — it's a glance, not
// the full lifecycle. ACTIVE stands in for everything pre-offer (the other
// pre-offer statuses are visible on the transactions list itself).
const PIPELINE: TransactionStatus[] = [
  TransactionStatus.ACTIVE,
  TransactionStatus.UNDER_CONTRACT,
  TransactionStatus.PENDING,
  TransactionStatus.CLOSED,
];

function dayKey(d: Date): string {
  return fmtDate(d);
}

function dayLabel(d: Date, todayKey: string): string {
  const key = dayKey(d);
  if (key === todayKey) return "Today";
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  if (key === dayKey(tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

/**
 * What outside coverage staff see instead of the workspace dashboard: the
 * files they were handed and their open tasks on those files. No pipeline
 * counts, no prospecting, nothing about the rest of the workspace.
 */
async function GuestDashboard({ tenantId, userId }: { tenantId: string; userId: string }) {
  const { files, tasks } = await withTenant(tenantId, async (tx) => {
    const files = await tx.transaction.findMany({
      where: { assignees: { some: { userId } } },
      orderBy: [{ closeDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
      select: {
        id: true,
        propertyAddress: true,
        status: true,
        closeDate: true,
        client: { select: { name: true } },
      },
    });
    return {
      files,
      tasks: await tx.task.findMany({
        where: {
          status: TaskStatus.OPEN,
          transaction: { assignees: { some: { userId } } },
        },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
        take: 25,
        include: { transaction: { select: { id: true, propertyAddress: true } } },
      }),
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-stone-500">Covering files</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Your files</h1>
      </div>
      <div className="columns-1 gap-6 lg:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid">
        <SectionCard title="Assigned to you" tour="day-assigned">
          <p className="mb-3 text-xs text-stone-400">
            You're working these files as outside coverage. You see only what you've been assigned.
          </p>
          {files.length === 0 ? (
            <EmptyState
              title="Nothing assigned yet"
              hint="The workspace that engaged you will assign the files they want covered."
            />
          ) : (
            <ul className="flex flex-col">
              {files.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                >
                  <Link
                    href={`/dashboard/transactions/${t.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {t.propertyAddress}
                  </Link>
                  <StatusBadge status={t.status} />
                  {t.client && <span className="text-stone-400">{t.client.name}</span>}
                  {t.closeDate && (
                    <span className="ml-auto tabular-nums text-stone-400">
                      closes {fmtDayMonth(t.closeDate)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        {tasks.length > 0 && (
          <SectionCard title="Open tasks on your files">
            <ul className="flex flex-col">
              {tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                >
                  <span className="whitespace-nowrap tabular-nums text-stone-500">
                    {fmtDayMonth(t.dueDate)}
                  </span>
                  <span>{t.title}</span>
                  {t.transaction && (
                    <Link
                      href={`/dashboard/transactions/${t.transaction.id}`}
                      className="ml-auto truncate text-brand-600 hover:underline"
                    >
                      {t.transaction.propertyAddress}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const chartRange = parseRange((await searchParams).range);
  const { tenantId, userId, isGuest } = await requireTenant({ allowGuest: true });
  // Everything on this page is workspace-wide. A guest gets only their own
  // assigned files instead — see GuestDashboard below.
  if (isGuest) return <GuestDashboard tenantId={tenantId} userId={userId} />;
  const now = new Date();
  const todayKey = dayKey(now);
  const soon = new Date(now);
  soon.setUTCDate(soon.getUTCDate() + 7);
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  // Files that have gone quiet, worst first — same verdict the transaction
  // page and the daily briefing show.
  const needsAttention = rankAlerts(await transactionAlerts(tenantId, now));

  // The money strip, for anyone with billing access: what's owed, what's
  // overdue, what came in this month, and whether any closed file slipped
  // through unbilled — the same figures the invoices page computes.
  const billingAccess = await getBillingAccess(tenantId, userId);
  const revenue = billingAccess.view
    ? await withTenant(tenantId, async (tx) => {
        const open = await tx.invoice.findMany({
          where: { status: "SENT" },
          select: {
            dueDate: true,
            lines: { select: { amountCents: true } },
            payments: { select: { amountCents: true } },
          },
        });
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const collected = await tx.invoicePayment.aggregate({
          where: { receivedAt: { gte: monthStart } },
          _sum: { amountCents: true },
        });
        const [closedFiles, invoices] = await Promise.all([
          tx.transaction.findMany({
            where: { status: "CLOSED" },
            select: { id: true, propertyAddress: true, status: true, expectedFeeCents: true },
          }),
          tx.invoice.findMany({
            select: {
              status: true,
              provider: true,
              transactionId: true,
              amountCents: true,
              lines: { select: { transactionId: true, amountCents: true } },
              payments: { select: { amountCents: true } },
            },
          }),
        ]);
        const outstanding = open.reduce(
          (s, i) => s + Math.max(0, invoiceMoney(i.lines, i.payments).balanceCents),
          0,
        );
        const overdue = open
          .filter((i) => agingBucket(i.dueDate) === "overdue")
          .reduce((s, i) => s + Math.max(0, invoiceMoney(i.lines, i.payments).balanceCents), 0);
        return {
          outstanding,
          overdue,
          collectedThisMonth: collected._sum.amountCents ?? 0,
          exceptions: billingExceptions(closedFiles, (id) => transactionBilling(id, invoices))
            .length,
        };
      })
    : null;

  // Files opened inside the chart window, for the two panels in the right
  // rail. Three columns only — this feeds a count and a ranking, not a list
  // anyone reads.
  const chartFiles = await withTenant(tenantId, (tx) =>
    tx.transaction.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - chartRange * 24 * 3600 * 1000) } },
      select: { createdAt: true, clientId: true, client: { select: { name: true } } },
    }),
  );
  const volumeBuckets = bucketByDay(
    chartFiles.map((t) => t.createdAt),
    chartRange,
    now,
  );
  const busiestClients = topClients(
    chartFiles.map((t) => ({ clientId: t.clientId, clientName: t.client?.name ?? null })),
  );

  const { counts, openTasks, closings, doneThisWeek, prospecting, recent, licenseAlerts, myFiles } =
    await withTenant(tenantId, async (tx) => ({
      counts: await tx.transaction.groupBy({ by: ["status"], _count: { _all: true } }),
      openTasks: await tx.task.findMany({
        // Undated tasks are included so a reopened task always lands
        // somewhere visible — nothing on this page may silently vanish.
        where: { status: TaskStatus.OPEN, OR: [{ dueDate: { lte: soon } }, { dueDate: null }] },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        take: 40,
        include: {
          transaction: {
            select: { id: true, propertyAddress: true, contractDate: true, closeDate: true },
          },
        },
      }),
      closings: await tx.transaction.findMany({
        where: {
          closeDate: { gte: now, lte: soon },
          status: { notIn: ["CLOSED", "CANCELLED"] },
        },
        orderBy: { closeDate: "asc" },
        select: { id: true, propertyAddress: true, closeDate: true },
      }),
      doneThisWeek: await tx.task.findMany({
        where: { status: TaskStatus.DONE, completedAt: { gte: weekAgo } },
        orderBy: { completedAt: "desc" },
        take: 15,
        include: { transaction: { select: { id: true, propertyAddress: true } } },
      }),
      prospecting: await tx.contact.findMany({
        where: { nextTouchAt: { lte: now } },
        orderBy: { nextTouchAt: "asc" },
        take: 5,
        select: { id: true, name: true, grade: true, nextTouchAt: true },
      }),
      recent: await tx.transaction.findMany({
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: { client: { select: { name: true } } },
      }),
      // Licenses running out (or already out) — surfaced until renewed.
      licenseAlerts: await tx.userLicense.findMany({
        where: { expiresAt: { lte: new Date(Date.now() + 60 * 24 * 3600 * 1000) } },
        orderBy: { expiresAt: "asc" },
        select: { id: true, state: true, expiresAt: true, user: { select: { name: true } } },
      }),
      // Files assigned to the signed-in user, active first.
      myFiles: await tx.transaction.findMany({
        where: {
          assignees: { some: { userId } },
          status: { notIn: ["CLOSED", "CANCELLED"] },
        },
        orderBy: [{ closeDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
        take: 8,
        select: {
          id: true,
          propertyAddress: true,
          status: true,
          side: true,
          closeDate: true,
          client: { select: { name: true } },
        },
      }),
    }));

  const countFor = (s: TransactionStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;

  const sortTasks = byPriorityThenDate<(typeof openTasks)[number]>((t) => t.transaction);
  const noDate = openTasks.filter((t) => !t.dueDate).sort(sortTasks);
  const overdue = openTasks
    .filter((t) => t.dueDate && dayKey(t.dueDate) < todayKey)
    .sort(sortTasks);
  const dueToday = openTasks
    .filter((t) => t.dueDate && dayKey(t.dueDate) === todayKey)
    .sort(sortTasks);
  const upcoming = openTasks.filter((t) => t.dueDate && dayKey(t.dueDate) > todayKey);

  // Agenda for the next 6 days after today: tasks + closings grouped per day.
  const agendaDays: Array<{
    date: Date;
    tasks: typeof upcoming;
    closings: typeof closings;
  }> = [];
  for (let i = 1; i <= 6; i++) {
    const date = new Date(now.getTime() + i * 24 * 3600 * 1000);
    const key = dayKey(date);
    const dayTasks = upcoming.filter((t) => t.dueDate && dayKey(t.dueDate) === key);
    const dayClosings = closings.filter((c) => c.closeDate && dayKey(c.closeDate) === key);
    if (dayTasks.length > 0 || dayClosings.length > 0) {
      agendaDays.push({ date, tasks: dayTasks, closings: dayClosings });
    }
  }
  const todayClosings = closings.filter((c) => c.closeDate && dayKey(c.closeDate) === todayKey);

  // "Today at a glance": rendered from cache, rewritten in the background when
  // it goes off. after() means opening the dashboard never waits on a model —
  // the cost is that a first-ever briefing appears on the next visit rather
  // than this one, which beats a spinner every morning.
  const hb = await handbookState(tenantId);
  const sideLabels = await tenantSideLabels(tenantId);
  // The two bell nudges, mirrored here so clicking the bell lands on
  // something that explains the count. Both are admin-only, matching how
  // the dashboard layout counts them.
  const nudgeAdmin = ["owner", "admin"].includes(await getMemberRole(tenantId, userId));
  const nudgeOrg = nudgeAdmin
    ? await prisma.organization.findUnique({
        where: { id: tenantId },
        select: { directoryConfig: true, cloudPromptConfig: true },
      })
    : null;
  const directoryNudge =
    nudgeAdmin && directoryNudgeDue(readDirectoryConfig(nudgeOrg?.directoryConfig));
  const cloudPrompt =
    nudgeAdmin && !isCloud() && cloudPromptDue(readCloudPromptConfig(nudgeOrg?.cloudPromptConfig))
      ? await getPlatformSettings().then((s) =>
          cloudPromptText(s.cloudPromptText, s.cloudPromptEnabled),
        )
      : null;
  const me = hb.summary
    ? await prisma.member.findFirst({
        where: { organizationId: tenantId, userId },
        select: {
          id: true,
          role: true,
          handbookSummary: true,
          handbookSummaryAt: true,
          user: { select: { name: true } },
        },
      })
    : null;
  const glanceStale = me ? isStale(me.handbookSummaryAt, now) : false;
  const myName = me?.user.name ?? null;

  if (me && glanceStale) {
    const viewer = { memberId: me.id, role: me.role as "owner" | "admin" | "member" };
    const notes = await withTenant(tenantId, (tx) =>
      tx.handbookNote.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    );
    const summaryInput = {
      viewer,
      personName: myName,
      overdue: overdue.map((t) => ({
        title: t.title,
        due: fmtDayMonth(t.dueDate, now),
        property: t.transaction?.propertyAddress ?? null,
      })),
      dueToday: dueToday.map((t) => ({
        title: t.title,
        property: t.transaction?.propertyAddress ?? null,
      })),
      closingSoon: closings
        .filter((c) => c.closeDate)
        .map((c) => ({
          property: c.propertyAddress ?? "A file",
          date: fmtDayMonth(c.closeDate, now),
        })),
      alerts: needsAttention
        .slice(0, 8)
        .map((a) =>
          a.staleness.stale
            ? `${a.propertyAddress} has been quiet for ${a.staleness.quietDays} days`
            : `${a.propertyAddress}: ${a.staleness.escalatedBy?.label ?? "needs attention"}`,
        ),
      // Filtered here as well as inside buildSummaryContext — the rows
      // shouldn't sit in this scope at all for someone who may not read them.
      notes: summaryNotesFor(viewer, notes, now),
    };
    after(async () => {
      const { refreshSummary } = await import("@/lib/handbook/summary");
      await refreshSummary(tenantId, me.id, summaryInput, now).catch(() => {});
    });
  }
  const doneToday = doneThisWeek.filter((t) => t.completedAt && dayKey(t.completedAt) === todayKey);
  const doneEarlier = doneThisWeek.filter(
    (t) => !(t.completedAt && dayKey(t.completedAt) === todayKey),
  );

  function TaskRow({ t, tone }: { t: (typeof openTasks)[number]; tone: "red" | "default" }) {
    const eff = effectivePriority(t, t.transaction ?? null);
    return (
      <li
        className="flex items-center gap-3 border-b border-stone-100 px-1 py-2 last:border-0"
        style={rowHighlightStyle(eff)}
      >
        <form action={toggleTask}>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="transactionId" value={t.transactionId ?? ""} />
          <button
            type="submit"
            title="Mark done"
            className="h-5 w-5 rounded border border-stone-300 transition-colors hover:border-brand-600"
          />
        </form>
        <span
          className={`whitespace-nowrap text-sm tabular-nums ${
            tone === "red" ? "font-medium text-red-600" : "text-stone-500"
          }`}
        >
          {fmtDayMonth(t.dueDate)}
        </span>
        <span className="text-sm">{t.title}</span>
        {PRIORITY_LABEL[eff] && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={priorityBadgeStyle(eff)}
          >
            {PRIORITY_LABEL[eff]}
          </span>
        )}
        {t.transaction && (
          <AddressPill
            href={`/dashboard/transactions/${t.transaction.id}`}
            className="ml-auto max-w-[12rem] sm:max-w-[16rem]"
          >
            {t.transaction.propertyAddress}
          </AddressPill>
        )}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {licenseAlerts.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Warning size={14} weight="fill" className="mr-1 inline text-amber-600" aria-hidden />
          {licenseAlerts.length === 1
            ? `${licenseAlerts[0].user.name}'s ${licenseAlerts[0].state} license ${
                licenseAlerts[0].expiresAt && licenseAlerts[0].expiresAt < now
                  ? "has expired"
                  : `expires ${fmtDate(licenseAlerts[0].expiresAt)}`
              }.`
            : `${licenseAlerts.length} team licenses are expired or expiring soon.`}{" "}
          <Link href="/dashboard/team" className="font-medium text-brand-700 underline">
            Review on Team
          </Link>
        </p>
      )}

      {/* The bell counts this, so the bell has to land somewhere that explains
          it. Dismissing lives on the directory page next to the switch — one
          place to decide, rather than a banner that can silence itself. */}
      {directoryNudge && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
          This workspace isn't listed in the coordinator directory, so other coordinators can't find
          you for overflow or vacation coverage.{" "}
          <Link href="/dashboard/directory" className="font-medium text-brand-700 underline">
            List it, or turn off the reminder →
          </Link>
        </p>
      )}

      {/* Self-host's monthly Freehold Cloud note. Same deal as the directory
          nudge: the bell counts it, so it needs somewhere to land. */}
      {cloudPrompt && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
          {cloudPrompt}{" "}
          <Link href="/dashboard/settings" className="font-medium text-brand-700 underline">
            More, or stop the reminder →
          </Link>
        </p>
      )}

      {/* Today at a glance and Needs attention side by side: the glance
          paragraph is capped at max-w-prose and never fills a full-width
          card on its own, so pairing it with the next panel instead of
          stacking them is what actually uses the width, not a wider cap on
          the paragraph. Falls back to a single column when only one of the
          two is showing. */}
      {(hb.summary || needsAttention.length > 0) && (
        <div
          data-tour="day-glance"
          className={
            hb.summary && needsAttention.length > 0
              ? "grid grid-cols-1 items-start gap-4 lg:grid-cols-2"
              : ""
          }
        >
          {hb.summary && (
            <HandbookGlance text={me?.handbookSummary ?? null} pending={glanceStale} />
          )}

          {/* Quiet files: a file nobody has touched is the thing most likely
              to go wrong, and it's invisible everywhere else on this page. */}
          {needsAttention.length > 0 && (
            <SectionCard
              title="Needs attention"
              count={needsAttention.length}
              icon={<Warning size={15} weight="fill" className="text-amber-600" aria-hidden />}
              className="border-amber-300/70"
            >
              <p className="mb-3 text-sm text-stone-500">
                Open tasks the weekend is about to catch, quiet files, and files with a critical
                date close enough that a quiet day matters.
              </p>
              <ul className="flex flex-col divide-y divide-stone-100">
                {needsAttention.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                    <AddressPill href={`/dashboard/transactions/${a.id}`}>
                      {a.propertyAddress}
                    </AddressPill>
                    {a.urgentTasks[0] &&
                      (() => {
                        const t = a.urgentTasks[0];
                        // The highlight gets more pronounced as the weekend
                        // closes in: still amber with two business days to go,
                        // solid red once it's down to the wire.
                        const critical = t.businessDaysAway <= 1;
                        return (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                              critical
                                ? "bg-red-600 text-white animate-pulse"
                                : "bg-amber-200 text-amber-900"
                            }`}
                          >
                            {activityTitle(t.title, 24)} ·{" "}
                            {t.calendarDaysAway === 0
                              ? "due today"
                              : `due in ${t.calendarDaysAway}d`}
                          </span>
                        );
                      })()}
                    {a.staleness.stale && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                        {a.staleness.quietDays}d quiet
                      </span>
                    )}
                    {a.staleness.escalatedBy && (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                        {a.staleness.escalatedBy.label}{" "}
                        {a.staleness.escalatedBy.daysAway === 0
                          ? "today"
                          : `in ${a.staleness.escalatedBy.daysAway}d`}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-stone-400">
                      {a.lastActivity
                        ? `${a.lastActivity.actorName} · ${a.lastActivity.summary}`
                        : "never touched"}
                    </span>
                  </li>
                ))}
              </ul>
              {needsAttention.length > 8 && (
                <p className="mt-2 text-xs text-stone-400">
                  +{needsAttention.length - 8} more.{" "}
                  <Link href="/dashboard/transactions" className="text-brand-700 underline">
                    See all transactions
                  </Link>
                </p>
              )}
            </SectionCard>
          )}
        </div>
      )}

      {/* Two columns: the day's work on the left (Today runs long, so it's
          the only thing in its column), everything else — stats first,
          then the rest of the week — stacked on the right. */}
      {/* Two thirds and a rail: the day's work reads down the left, the
          numbers sit beside it. Everything in the rail is a figure or a small
          chart — none of it needs width, and moving it out of the flow stops
          the left column running alone down a 1600px screen. */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {/* Today */}
          <SectionCard
            tour="day-today"
            title="Today"
            icon={<Sun size={15} weight="fill" className="text-brand-600" aria-hidden />}
          >
            {todayClosings.map((c) => (
              <AddressPill
                key={c.id}
                href={`/dashboard/transactions/${c.id}`}
                className="mb-2 w-full px-3 py-2.5"
                icon={<CalendarCheck size={17} weight="fill" aria-hidden />}
              >
                Closing day — {c.propertyAddress}
              </AddressPill>
            ))}

            {overdue.length > 0 && (
              <div className="mb-3">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-red-600">
                  <Warning size={15} weight="fill" aria-hidden />
                  Overdue
                </h3>
                <ul className="flex flex-col">
                  {overdue.map((t) => (
                    <TaskRow key={t.id} t={t} tone="red" />
                  ))}
                </ul>
              </div>
            )}

            {dueToday.length > 0 ? (
              <ul className="flex flex-col">
                {dueToday.map((t) => (
                  <TaskRow key={t.id} t={t} tone="default" />
                ))}
              </ul>
            ) : (
              overdue.length === 0 &&
              todayClosings.length === 0 &&
              doneToday.length === 0 &&
              noDate.length === 0 && (
                <p className="text-sm text-stone-500">Nothing due today. Enjoy the quiet.</p>
              )
            )}

            {noDate.length > 0 && (
              <div
                className={
                  dueToday.length > 0 || overdue.length > 0
                    ? "mt-3 border-t border-stone-100 pt-2"
                    : ""
                }
              >
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
                  Anytime — no due date
                </h3>
                <ul className="flex flex-col">
                  {noDate.map((t) => (
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
                          className="h-5 w-5 rounded border border-stone-300 transition-colors hover:border-brand-600"
                        />
                      </form>
                      <span className="text-sm">{t.title}</span>
                      {t.transaction && (
                        <AddressPill
                          href={`/dashboard/transactions/${t.transaction.id}`}
                          className="ml-auto max-w-[12rem] sm:max-w-[16rem]"
                        >
                          {t.transaction.propertyAddress}
                        </AddressPill>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {doneToday.length > 0 && (
              <div
                className={
                  dueToday.length > 0 || overdue.length > 0 || noDate.length > 0
                    ? "mt-3 border-t border-stone-100 pt-2"
                    : ""
                }
              >
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
                  Done today — click a check to undo
                </h3>
                <ul className="flex flex-col">
                  {doneToday.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 border-b border-stone-100 py-2 last:border-0"
                    >
                      <form action={toggleTask}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="transactionId" value={t.transactionId ?? ""} />
                        <button
                          type="submit"
                          title="Undo — reopen this task"
                          className="flex h-5 w-5 items-center justify-center rounded border border-brand-600 bg-brand-600 text-xs text-white transition hover:bg-brand-700"
                        >
                          ✓
                        </button>
                      </form>
                      <span className="text-sm text-stone-400 line-through">{t.title}</span>
                      {t.transaction && (
                        <AddressPill
                          href={`/dashboard/transactions/${t.transaction.id}`}
                          className="ml-auto max-w-[12rem] sm:max-w-[16rem]"
                        >
                          {t.transaction.propertyAddress}
                        </AddressPill>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          {/* Your assigned files */}
          {myFiles.length > 0 && (
            <SectionCard title="Your files">
              <p className="mb-2 text-xs text-stone-400">
                Active transactions assigned to you, soonest closing first.
              </p>
              <ul className="flex flex-col">
                {myFiles.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                  >
                    <SideBadge side={t.side} labels={sideLabels} />
                    <AddressPill href={`/dashboard/transactions/${t.id}`}>
                      {t.propertyAddress}
                    </AddressPill>
                    <StatusBadge status={t.status} />
                    {t.client && <span className="text-stone-400">{t.client.name}</span>}
                    {t.closeDate && (
                      <span className="ml-auto tabular-nums text-stone-400">
                        closes {fmtDayMonth(t.closeDate)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard/transactions?mine=1"
                className="mt-2 inline-block text-sm text-brand-700 hover:underline"
              >
                All your files →
              </Link>
            </SectionCard>
          )}

          {/* Prospecting queue */}
          {prospecting.length > 0 && (
            <SectionCard title="Prospecting due">
              <p className="mb-2 text-xs text-stone-400">
                Contacts whose auto-prospect cadence says it's time. Open one and hit "Touched
                today" when you've reached out.
              </p>
              <ul className="flex flex-col">
                {prospecting.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                  >
                    <Link
                      href={`/dashboard/contacts/${c.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.grade && (
                      <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-800">
                        {c.grade}
                      </span>
                    )}
                    <span className="ml-auto tabular-nums text-stone-400">
                      due {fmtDayMonth(c.nextTouchAt)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard/contacts?view=touch"
                className="mt-2 inline-block text-sm text-brand-700 hover:underline"
              >
                All due contacts →
              </Link>
            </SectionCard>
          )}
          {/* Week agenda */}
          <SectionCard title="Next 7 days" tour="day-week">
            {agendaDays.length === 0 ? (
              <p className="text-sm text-stone-500">No deadlines or closings on the horizon.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {agendaDays.map(({ date, tasks, closings: dayClosings }) => (
                  <div key={dayKey(date)} className="flex gap-4">
                    <div className="w-24 shrink-0 pt-1.5">
                      <p className="text-sm font-medium">{dayLabel(date, todayKey)}</p>
                      <p className="text-xs tabular-nums text-stone-400">{fmtDayMonth(date)}</p>
                    </div>
                    <div className="min-w-0 flex-1 border-l-2 border-stone-100 pl-4">
                      {dayClosings.map((c) => (
                        <AddressPill
                          key={c.id}
                          href={`/dashboard/transactions/${c.id}`}
                          className="mb-1 w-full px-2.5 py-1.5"
                          icon={<CalendarCheck size={15} weight="fill" aria-hidden />}
                        >
                          Closing — {c.propertyAddress}
                        </AddressPill>
                      ))}
                      <ul className="flex flex-col">
                        {tasks.map((t) => (
                          <TaskRow key={t.id} t={t} tone="default" />
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Done earlier this week */}
          {doneEarlier.length > 0 && (
            <SectionCard
              title="Done earlier this week"
              icon={<CheckCircle size={15} weight="fill" className="text-brand-600" aria-hidden />}
            >
              <p className="mb-2 text-xs text-stone-400">Click a check to undo.</p>
              <ul className="flex flex-col">
                {doneEarlier.map((t) => {
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
                          title="Undo — reopen this task"
                          className="flex h-5 w-5 items-center justify-center rounded border border-brand-600 bg-brand-600 text-xs text-white transition hover:bg-brand-700"
                        >
                          ✓
                        </button>
                      </form>
                      <span className="whitespace-nowrap text-sm tabular-nums text-stone-400">
                        {fmtDayMonth(t.completedAt)}
                      </span>
                      <span className="text-sm text-stone-400 line-through">{t.title}</span>
                      {t.transaction && (
                        <AddressPill
                          href={`/dashboard/transactions/${t.transaction.id}`}
                          className="ml-auto max-w-[12rem] sm:max-w-[16rem]"
                        >
                          {t.transaction.propertyAddress}
                        </AddressPill>
                      )}
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )}

          {/* Recent transactions */}
          <SectionCard title="Recent transactions">
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
              <div className={tableWrap}>
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
                          <span className="flex items-center gap-2">
                            <SideBadge side={t.side} labels={sideLabels} />
                            <AddressPill href={`/dashboard/transactions/${t.id}`}>
                              {t.propertyAddress}
                            </AddressPill>
                          </span>
                        </td>
                        <td className={td}>{t.client?.name ?? "—"}</td>
                        <td className={td}>
                          <StatusBadge status={t.status} />
                        </td>
                        <td className={td}>{fmtDayMonth(t.closeDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <HubNews />
        </div>

        {/* Sticky: the rail is always shorter than the day's task list, and
            letting it end early left a dead patch of empty column beside a
            long Today list. Pinning it near the top means it's still there
            rather than trailing off into blank space. */}
        <div className="flex flex-col gap-6 xl:sticky xl:top-6">
          {revenue && (
            <SectionCard
              title="Money"
              action={
                <Link href="/dashboard/invoices" className="text-xs text-brand-700 hover:underline">
                  Invoices →
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {(
                  [
                    ["Outstanding", fmtCents(revenue.outstanding), "text-stone-800"],
                    [
                      "Overdue",
                      fmtCents(revenue.overdue),
                      revenue.overdue > 0 ? "text-red-700" : "text-stone-800",
                    ],
                    [
                      "Collected this month",
                      fmtCents(revenue.collectedThisMonth),
                      revenue.collectedThisMonth > 0 ? "text-brand-700" : "text-stone-800",
                    ],
                    [
                      "Closed unbilled",
                      String(revenue.exceptions),
                      revenue.exceptions > 0 ? "text-amber-700" : "text-stone-800",
                    ],
                  ] as const
                ).map(([labelText, value, tone]) => (
                  <div key={labelText} className="flex flex-col">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                      {labelText}
                    </span>
                    <span className={`tabular-nums text-lg font-semibold ${tone}`}>{value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
          <SectionCard title="Transaction stats" bodyClassName="p-0">
            <div className="grid grid-cols-2">
              {PIPELINE.map((s, i) => (
                <Link
                  key={s}
                  href={`/dashboard/transactions?status=${s}`}
                  className={`flex flex-col gap-0.5 border-stone-100 px-4 py-3 transition-colors hover:bg-stone-50 ${
                    [
                      "border-b border-r sm:border-b-0",
                      "border-b sm:border-b-0 sm:border-r",
                      "border-r",
                      "",
                    ][i]
                  }`}
                >
                  <span className="font-serif text-2xl font-semibold tabular-nums leading-none">
                    {countFor(s)}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-stone-500">
                    <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${statusDot(s)}`} />
                    {STATUS_LABEL[s]}
                  </span>
                </Link>
              ))}
            </div>
          </SectionCard>

          {/* Both panels read the same window, so one range switch governs
              both — two switches a few pixels apart would only ever be set to
              the same value. */}
          <SectionCard
            title="New files"
            tooltip="Files opened in the selected window."
            action={<RangeSwitch active={chartRange} />}
          >
            <VolumeChart buckets={volumeBuckets} range={chartRange} />
          </SectionCard>

          <SectionCard title="Busiest clients" tooltip="Who sent the most work in the window.">
            <TopClientsChart clients={busiestClients} range={chartRange} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
