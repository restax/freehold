import { TaskStatus, TransactionStatus, withTenant } from "@freehold/db";
import { HouseLine } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { regenerateCalendarToken } from "@/lib/actions/calendar";
import { calendarFeedUrl, ensureCalendarToken } from "@/lib/calendar";
import { priorityBadgeStyle } from "@/lib/priority";
import { requireTenant } from "@/lib/tenant";
import { btnGhost, card } from "@/lib/ui";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseMonth(month: string | undefined): Date {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

interface DayEvent {
  key: string;
  href: string;
  label: string;
  kind: "closing" | "CRITICAL" | "HIGH" | "NORMAL";
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; scope?: string }>;
}) {
  const { tenantId, userId, isGuest } = await requireTenant({ allowGuest: true });
  const { month: monthParam, scope: scopeParam } = await searchParams;
  const scope = isGuest ? "mine" : scopeParam === "mine" ? "mine" : "all";

  const monthStart = parseMonth(monthParam);
  // Pad to a full 6-row grid starting on Sunday so the layout never jumps.
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(gridStart);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + 42);

  const taskScope = isGuest
    ? { transaction: { assignees: { some: { userId } } } }
    : scope === "mine"
      ? { assigneeId: userId }
      : {};

  const { tasks, closings, token } = await withTenant(tenantId, async (tx) => ({
    tasks: await tx.task.findMany({
      where: {
        status: TaskStatus.OPEN,
        dueDate: { gte: gridStart, lt: gridEnd },
        ...taskScope,
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        transaction: { select: { id: true, propertyAddress: true } },
      },
    }),
    closings: await tx.transaction.findMany({
      where: {
        closeDate: { gte: gridStart, lt: gridEnd },
        status: { notIn: [TransactionStatus.CLOSED, TransactionStatus.CANCELLED] },
        ...(isGuest || scope === "mine" ? { assignees: { some: { userId } } } : {}),
      },
      select: { id: true, propertyAddress: true, closeDate: true },
    }),
    token: await ensureCalendarToken(tenantId, userId),
  }));

  const byDay = new Map<string, DayEvent[]>();
  const push = (key: string, e: DayEvent) => {
    const list = byDay.get(key) ?? [];
    list.push(e);
    byDay.set(key, list);
  };
  for (const t of tasks) {
    if (!t.dueDate) continue;
    push(dayKey(t.dueDate), {
      key: `task-${t.id}`,
      href: t.transaction ? `/dashboard/transactions/${t.transaction.id}` : "#",
      label: t.transaction ? `${t.title} — ${t.transaction.propertyAddress}` : t.title,
      kind: t.priority as DayEvent["kind"],
    });
  }
  for (const t of closings) {
    if (!t.closeDate) continue;
    push(dayKey(t.closeDate), {
      key: `close-${t.id}`,
      href: `/dashboard/transactions/${t.id}`,
      label: `Closing — ${t.propertyAddress}`,
      kind: "closing",
    });
  }

  const todayKey = dayKey(new Date());
  const cells: Date[] = [];
  for (let d = new Date(gridStart); d < gridEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    cells.push(new Date(d));
  }

  const monthLabel = monthStart.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const feedUrl = calendarFeedUrl(token);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">Every dated task and closing</p>
          <h1 className="text-xl font-semibold">Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          {!isGuest && (
            <div className="flex overflow-hidden rounded-lg border border-stone-300 text-sm">
              <Link
                href={`/dashboard/calendar?month=${monthKey(monthStart)}&scope=mine`}
                className={`px-3 py-1.5 ${scope === "mine" ? "bg-brand-700 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}
              >
                Mine
              </Link>
              <Link
                href={`/dashboard/calendar?month=${monthKey(monthStart)}&scope=all`}
                className={`px-3 py-1.5 ${scope === "all" ? "bg-brand-700 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}
              >
                Everyone
              </Link>
            </div>
          )}
          <Link
            href={`/dashboard/calendar?month=${monthKey(addMonths(monthStart, -1))}&scope=${scope}`}
            className={btnGhost}
            aria-label="Previous month"
          >
            ←
          </Link>
          <Link
            href={`/dashboard/calendar?month=${monthKey(new Date())}&scope=${scope}`}
            className={btnGhost}
          >
            Today
          </Link>
          <Link
            href={`/dashboard/calendar?month=${monthKey(addMonths(monthStart, 1))}&scope=${scope}`}
            className={btnGhost}
            aria-label="Next month"
          >
            →
          </Link>
        </div>
      </div>

      <section className={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight">{monthLabel}</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden /> Critical
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden /> High
            </span>
            <span className="flex items-center gap-1.5">
              <HouseLine size={12} weight="fill" className="text-brand-600" aria-hidden /> Closing
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-stone-200">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="bg-stone-50 px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-stone-500"
            >
              {w}
            </div>
          ))}
          {cells.map((d) => {
            const key = dayKey(d);
            const inMonth = d.getUTCMonth() === monthStart.getUTCMonth();
            const events = byDay.get(key) ?? [];
            const shown = events.slice(0, 3);
            const overflow = events.length - shown.length;
            return (
              <div
                key={key}
                className={`min-h-[92px] bg-white p-1.5 ${inMonth ? "" : "bg-stone-50/60"}`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs tabular-nums ${
                    key === todayKey
                      ? "bg-brand-700 font-semibold text-white"
                      : inMonth
                        ? "text-stone-700"
                        : "text-stone-300"
                  }`}
                >
                  {d.getUTCDate()}
                </span>
                <div className="mt-1 flex flex-col gap-0.5">
                  {shown.map((e) => (
                    <Link
                      key={e.key}
                      href={e.href}
                      title={e.label}
                      className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight hover:opacity-80 ${
                        e.kind === "closing"
                          ? "bg-brand-50 text-brand-800"
                          : e.kind === "CRITICAL" || e.kind === "HIGH"
                            ? ""
                            : "bg-stone-100 text-stone-700"
                      }`}
                      style={
                        e.kind === "CRITICAL" || e.kind === "HIGH"
                          ? priorityBadgeStyle(e.kind)
                          : undefined
                      }
                    >
                      {e.kind === "closing" && (
                        <HouseLine size={10} weight="fill" className="mr-0.5 inline" aria-hidden />
                      )}
                      {e.label}
                    </Link>
                  ))}
                  {overflow > 0 && (
                    <span className="px-1 text-[11px] text-stone-400">+{overflow} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-medium">Subscribe from any calendar app</h2>
        <p className="mb-3 text-sm text-stone-500">
          This link is yours alone — a secret URL, not a login. Paste it into Google Calendar,
          Outlook, or Apple Calendar as a "subscribe by URL" feed, and it stays current: new dates
          appear on the app's next refresh, nothing to re-import.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="max-w-full flex-1 truncate rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
            {feedUrl}
          </code>
          <CopyButton text={feedUrl} />
        </div>
        <form action={regenerateCalendarToken} className="mt-3">
          <button type="submit" className="text-xs text-stone-400 hover:text-red-700">
            Lost a device? Regenerate this link (the old one stops working immediately)
          </button>
        </form>
      </section>
    </div>
  );
}
