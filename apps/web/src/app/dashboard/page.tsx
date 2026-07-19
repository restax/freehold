import { TaskStatus, TransactionStatus, withTenant } from "@freehold/db";
import { CalendarCheck, CheckCircle, Sun, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { StatusBadge, statusDot } from "@/components/badges";
import { DemoWelcome } from "@/components/demo-welcome";
import { EmptyState } from "@/components/empty-state";
import { HubNews } from "@/components/hub-news";
import { toggleTask } from "@/lib/actions/tasks";
import { fmtDate, STATUS_LABEL } from "@/lib/format";
import {
  byPriorityThenDate,
  effectivePriority,
  PRIORITY_BADGE,
  PRIORITY_LABEL,
} from "@/lib/priority";
import { requireTenant } from "@/lib/tenant";
import { card, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const PIPELINE: TransactionStatus[] = [
  TransactionStatus.LISTING,
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

export default async function DashboardPage() {
  const { tenantId } = await requireTenant();
  const now = new Date();
  const todayKey = dayKey(now);
  const soon = new Date(now);
  soon.setUTCDate(soon.getUTCDate() + 7);
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const { counts, openTasks, closings, doneThisWeek, prospecting, recent } = await withTenant(
    tenantId,
    async (tx) => ({
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
    }),
  );

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
  const doneToday = doneThisWeek.filter((t) => t.completedAt && dayKey(t.completedAt) === todayKey);
  const doneEarlier = doneThisWeek.filter(
    (t) => !(t.completedAt && dayKey(t.completedAt) === todayKey),
  );

  const heading = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  function TaskRow({ t, tone }: { t: (typeof openTasks)[number]; tone: "red" | "default" }) {
    return (
      <li className="flex items-center gap-3 border-b border-stone-100 py-2 last:border-0">
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
          {fmtDate(t.dueDate)}
        </span>
        <span className="text-sm">{t.title}</span>
        {(() => {
          const eff = effectivePriority(t, t.transaction ?? null);
          return PRIORITY_LABEL[eff] ? (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_BADGE[eff]}`}
            >
              {PRIORITY_LABEL[eff]}
            </span>
          ) : null;
        })()}
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
  }

  return (
    <div className="flex flex-col gap-6">
      <DemoWelcome />
      <div>
        <p className="text-sm text-stone-500">{heading}</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Your day</h1>
      </div>

      {/* Today */}
      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 font-medium">
          <Sun size={18} weight="fill" className="text-brand-600" aria-hidden />
          Today
        </h2>

        {todayClosings.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/transactions/${c.id}`}
            className="mb-2 flex items-center gap-2.5 rounded-lg bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-800 transition-colors hover:bg-brand-100"
          >
            <CalendarCheck size={17} weight="fill" className="text-brand-700" aria-hidden />
            Closing day — {c.propertyAddress}
          </Link>
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
              dueToday.length > 0 || overdue.length > 0 ? "mt-3 border-t border-stone-100 pt-2" : ""
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
                    <Link
                      href={`/dashboard/transactions/${t.transaction.id}`}
                      className="ml-auto truncate text-sm text-brand-600 hover:underline"
                    >
                      {t.transaction.propertyAddress}
                    </Link>
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
                    <Link
                      href={`/dashboard/transactions/${t.transaction.id}`}
                      className="ml-auto truncate text-sm text-stone-400 hover:text-brand-600 hover:underline"
                    >
                      {t.transaction.propertyAddress}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Prospecting queue */}
      {prospecting.length > 0 && (
        <section className={card}>
          <h2 className="mb-1 font-medium">Prospecting due</h2>
          <p className="mb-2 text-xs text-stone-400">
            Contacts whose auto-prospect cadence says it's time. Open one and hit "Touched today"
            when you've reached out.
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
                  due {fmtDate(c.nextTouchAt)}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/contacts?due=1"
            className="mt-2 inline-block text-sm text-brand-700 hover:underline"
          >
            All due contacts →
          </Link>
        </section>
      )}

      {/* Week agenda */}
      <section className={card}>
        <h2 className="mb-3 font-medium">Next 7 days</h2>
        {agendaDays.length === 0 ? (
          <p className="text-sm text-stone-500">No deadlines or closings on the horizon.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {agendaDays.map(({ date, tasks, closings: dayClosings }) => (
              <div key={dayKey(date)} className="flex gap-4">
                <div className="w-24 shrink-0 pt-1.5">
                  <p className="text-sm font-medium">{dayLabel(date, todayKey)}</p>
                  <p className="text-xs tabular-nums text-stone-400">{dayKey(date)}</p>
                </div>
                <div className="min-w-0 flex-1 border-l-2 border-stone-100 pl-4">
                  {dayClosings.map((c) => (
                    <Link
                      key={c.id}
                      href={`/dashboard/transactions/${c.id}`}
                      className="mb-1 flex items-center gap-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-sm font-medium text-brand-800 transition-colors hover:bg-brand-100"
                    >
                      <CalendarCheck
                        size={15}
                        weight="fill"
                        className="text-brand-700"
                        aria-hidden
                      />
                      Closing — {c.propertyAddress}
                    </Link>
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
      </section>

      {/* Pipeline */}
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

      {/* Done earlier this week */}
      {doneEarlier.length > 0 && (
        <section className={card}>
          <h2 className="mb-1 flex items-center gap-2 font-medium">
            <CheckCircle size={18} weight="fill" className="text-brand-600" aria-hidden />
            Done earlier this week
          </h2>
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
                    {fmtDate(t.completedAt)}
                  </span>
                  <span className="text-sm text-stone-400 line-through">{t.title}</span>
                  {t.transaction && (
                    <Link
                      href={`/dashboard/transactions/${t.transaction.id}`}
                      className="ml-auto truncate text-sm text-stone-400 hover:text-brand-600 hover:underline"
                    >
                      {t.transaction.propertyAddress}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Recent transactions */}
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
