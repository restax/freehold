import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { isOperator } from "@/lib/operator";
import { effectiveTier, PLAN_INFO } from "@/lib/plans";
import { td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const DAY = 24 * 3600 * 1000;
const TREND_DAYS = 14;

/** Plain-English bucket for an activity key such as "task.completed". */
const AREA_LABEL: Record<string, string> = {
  task: "Tasks",
  document: "Attachments",
  email: "Email",
  portal: "Client portal",
  transaction: "Transactions",
  invoice: "Invoices",
  payment: "Payments",
  pay: "Payments",
  vendor: "Vendor orders",
  website: "Website",
  ticket: "Support",
};
const areaOf = (action: string) => {
  const key = action.split(".")[0] ?? action;
  return AREA_LABEL[key] ?? "Other";
};

/** "YYYY-MM-DD" in UTC, the only day boundary the server can state exactly. */
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const parseDay = (s: string | undefined) => {
  const base = s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : new Date();
  const start = new Date(`${dayKey(base)}T00:00:00Z`);
  return Number.isNaN(start.getTime()) ? new Date(`${dayKey(new Date())}T00:00:00Z`) : start;
};
const fmtLong = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

interface PersonDay {
  id: string;
  name: string;
  email: string;
  workspaces: { name: string; tier: string }[];
  firstSeen: Date | null;
  lastSeen: Date | null;
  areas: Map<string, number>;
  total: number;
}

/**
 * Operator view of who used the product on a given day and what kind of work
 * they did, so a quiet account or a busy one can be reached out to. Reads the
 * file activity feed (who did what, by area) and session activity (who was in
 * at all). Counts only, never the content of a note, document or message.
 * Days run midnight to midnight UTC.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  if (!(await isOperator())) notFound();
  const day = parseDay((await searchParams).day);
  const next = new Date(day.getTime() + DAY);
  const trendStart = new Date(day.getTime() - (TREND_DAYS - 1) * DAY);

  // Everyone whose session was touched on the day; sessions carry no RLS.
  const sessions = await prisma.session.findMany({
    where: { updatedAt: { gte: trendStart, lt: next } },
    select: { userId: true, createdAt: true, updatedAt: true },
  });

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, planTier: true, compTier: true, compExpiresAt: true },
  });

  // Per workspace: the day's activity rows (grouped), and the trend window's actors.
  const perOrg = await Promise.all(
    orgs.map(async (o) => {
      const rows = await withTenant(o.id, (tx) =>
        tx.transactionActivity.findMany({
          where: { createdAt: { gte: trendStart, lt: next }, actorId: { not: null } },
          select: { actorId: true, action: true, createdAt: true },
        }),
      ).catch(() => []);
      return { org: o, rows };
    }),
  );

  const dayStartMs = day.getTime();
  const inDay = (d: Date) => d.getTime() >= dayStartMs && d.getTime() < next.getTime();

  // Distinct people active per day for the trend strip (session touch or any action).
  const trend = new Map<string, Set<string>>();
  const mark = (d: Date, id: string) => {
    const k = dayKey(d);
    if (!trend.has(k)) trend.set(k, new Set());
    trend.get(k)?.add(id);
  };
  for (const s of sessions) mark(s.updatedAt, s.userId);
  for (const { rows } of perOrg) for (const r of rows) if (r.actorId) mark(r.createdAt, r.actorId);

  const ids = new Set<string>();
  const actions = new Map<string, Map<string, number>>();
  const times = new Map<string, Date[]>();
  const userOrgs = new Map<string, Set<string>>();
  for (const { org, rows } of perOrg) {
    for (const r of rows) {
      if (!r.actorId || !inDay(r.createdAt)) continue;
      ids.add(r.actorId);
      const m = actions.get(r.actorId) ?? new Map<string, number>();
      const area = areaOf(r.action);
      m.set(area, (m.get(area) ?? 0) + 1);
      actions.set(r.actorId, m);
      times.set(r.actorId, [...(times.get(r.actorId) ?? []), r.createdAt]);
      userOrgs.set(r.actorId, (userOrgs.get(r.actorId) ?? new Set()).add(org.id));
    }
  }
  for (const s of sessions) if (inDay(s.updatedAt)) ids.add(s.userId);

  const users = ids.size
    ? await prisma.user.findMany({
        where: { id: { in: [...ids] }, isClientIdentity: false },
        select: {
          id: true,
          name: true,
          email: true,
          members: { select: { organization: { select: { id: true } } } },
        },
      })
    : [];
  const orgById = new Map(orgs.map((o) => [o.id, o]));

  const people: PersonDay[] = users.map((u) => {
    const mine = sessions.filter((s) => s.userId === u.id && inDay(s.updatedAt));
    const stamps = [...mine.map((s) => s.updatedAt), ...(times.get(u.id) ?? [])].sort(
      (a, b) => a.getTime() - b.getTime(),
    );
    const areas = actions.get(u.id) ?? new Map<string, number>();
    const orgIds = new Set(u.members.map((m) => m.organization.id));
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      workspaces: [...orgIds].flatMap((id) => {
        const o = orgById.get(id);
        return o ? [{ name: o.name, tier: PLAN_INFO[effectiveTier(o)].label }] : [];
      }),
      firstSeen: stamps[0] ?? null,
      lastSeen: stamps[stamps.length - 1] ?? null,
      areas,
      total: [...areas.values()].reduce((a, b) => a + b, 0),
    };
  });
  people.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const working = people.filter((p) => p.total > 0);
  const lookedOnly = people.filter((p) => p.total === 0);
  const trendDays = Array.from({ length: TREND_DAYS }, (_, i) =>
    dayKey(new Date(trendStart.getTime() + i * DAY)),
  );
  const peak = Math.max(1, ...trendDays.map((k) => trend.get(k)?.size ?? 0));
  const prev = dayKey(new Date(day.getTime() - DAY));
  const todayKey = dayKey(new Date());
  const nextKey = dayKey(next);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title={fmtLong(day)}
        count={people.length}
        action={
          <div className="flex items-center gap-1.5 text-xs">
            <Link
              href={`/admin/activity?day=${prev}`}
              className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-50"
            >
              Previous day
            </Link>
            {dayKey(day) < todayKey && (
              <Link
                href={`/admin/activity?day=${nextKey}`}
                className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-50"
              >
                Next day
              </Link>
            )}
            {dayKey(day) !== todayKey && (
              <Link
                href="/admin/activity"
                className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-50"
              >
                Today
              </Link>
            )}
          </div>
        }
      >
        <div className="flex items-end gap-1" role="img" aria-label="People active per day">
          {trendDays.map((k) => {
            const n = trend.get(k)?.size ?? 0;
            return (
              <Link
                key={k}
                href={`/admin/activity?day=${k}`}
                title={`${k}: ${n} active`}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span className="text-xs tabular-nums text-stone-500">{n}</span>
                <span
                  className={`w-full rounded-sm ${k === dayKey(day) ? "bg-brand-600" : "bg-stone-300"}`}
                  style={{ height: `${Math.max(3, Math.round((n / peak) * 56))}px` }}
                />
                <span className="text-xs text-stone-400">{k.slice(8)}</span>
              </Link>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Did work" count={working.length} bodyClassName="">
        <PeopleTable people={working} empty="No one logged work on this day." />
      </SectionCard>

      <SectionCard title="Signed in only" count={lookedOnly.length} bodyClassName="">
        <PeopleTable people={lookedOnly} empty="No one else was in." />
      </SectionCard>
    </div>
  );
}

function PeopleTable({ people, empty }: { people: PersonDay[]; empty: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className={th}>Person</th>
            <th className={th}>Workspace</th>
            <th className={th}>First seen</th>
            <th className={th}>Last seen</th>
            <th className={th}>Actions</th>
            <th className={th}>What they worked on</th>
          </tr>
        </thead>
        <tbody>
          {people.length === 0 && (
            <tr>
              <td className={`${td} text-stone-400`} colSpan={6}>
                {empty}
              </td>
            </tr>
          )}
          {people.map((p) => (
            <tr key={p.id} className={trHover}>
              <td className={td}>
                <Link
                  href={`/admin/signups?q=${encodeURIComponent(p.email)}`}
                  className="hover:underline"
                >
                  <span className="font-medium">{p.name}</span>
                </Link>
                <span className="ml-2 text-xs text-stone-400">{p.email}</span>
              </td>
              <td className={td}>
                {p.workspaces.length === 0 ? (
                  <span className="text-stone-300">none yet</span>
                ) : (
                  p.workspaces.map((w) => (
                    <span key={w.name} className="mr-2">
                      {w.name} <span className="text-xs text-stone-400">{w.tier}</span>
                    </span>
                  ))
                )}
              </td>
              <td className={td}>{p.firstSeen ? fmtTime(p.firstSeen) : ""}</td>
              <td className={td}>{p.lastSeen ? fmtTime(p.lastSeen) : ""}</td>
              <td className={td}>{p.total}</td>
              <td className={`${td} text-sm`}>
                {[...p.areas.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([area, n]) => `${area} ${n}`)
                  .join(" · ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
