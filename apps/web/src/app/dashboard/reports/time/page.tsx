import { prisma, withTenant } from "@freehold/db";
import { Clock } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { AddressPill } from "@/components/address-pill";
import { SectionCard } from "@/components/section-card";
import { CHART_RANGES, type ChartRange, parseRange } from "@/lib/dashboard-charts";
import { fmtCents } from "@/lib/pay";
import { requireTenant } from "@/lib/tenant";
import {
  effectiveHourlyCents,
  efficientClients,
  type FileTime,
  fmtMinutes,
  timeByClient,
  timeByPerson,
  timeTotals,
} from "@/lib/time-tracking";
import { tableWrap, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

/**
 * Time on files, in full.
 *
 * The three Today panels answer "is anything obviously wrong"; this answers
 * "where did the month actually go". Same ledger, no new recording: every
 * figure here is derived from the per-(file, person, day) rows the presence
 * ping already writes.
 *
 * The per-person table exists only on this page. On the dashboard it would
 * turn a file-cost feature into a scoreboard over someone's shoulder; on a
 * report an owner opens deliberately, "who has capacity" is a fair question.
 */

function RangeLinks({ active }: { active: ChartRange }) {
  return (
    <div className="flex items-center gap-1">
      {CHART_RANGES.map((r) => (
        <Link
          key={r}
          href={`/dashboard/reports/time?range=${r}`}
          scroll={false}
          aria-current={r === active ? "true" : undefined}
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
            r === active
              ? "bg-brand-700 text-[var(--color-brand-fg)]"
              : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          }`}
        >
          {r}d
        </Link>
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-stone-100 px-4 py-3 [&:not(:last-child)]:border-r">
      <span className="font-serif text-2xl font-semibold leading-none tabular-nums">{value}</span>
      <span className="text-xs text-stone-500">{label}</span>
      {hint && <span className="text-[11px] text-stone-400">{hint}</span>}
    </div>
  );
}

export default async function TimeReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const range = parseRange((await searchParams).range);

  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { timeTrackingEnabled: true },
  });

  const since = new Date(Date.now() - range * 24 * 3600 * 1000);
  const data = await withTenant(tenantId, async (tx) => {
    const entries = await tx.transactionTimeEntry.findMany({
      where: { day: { gte: since } },
      select: { transactionId: true, userId: true, minutes: true, touches: true },
    });
    if (entries.length === 0) return { files: [] as FileTime[], people: [], touches: 0 };

    const txns = await tx.transaction.findMany({
      where: { id: { in: [...new Set(entries.map((e) => e.transactionId))] } },
      select: {
        id: true,
        propertyAddress: true,
        expectedFeeCents: true,
        clientId: true,
        client: { select: { name: true } },
      },
    });
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(entries.map((e) => e.userId))] } },
      select: { id: true, name: true, email: true },
    });

    const byTxn = new Map(txns.map((t) => [t.id, t]));
    const nameOf = new Map(users.map((u) => [u.id, u.name || u.email || "Someone"]));

    const minutesByTxn = new Map<string, number>();
    for (const e of entries) {
      minutesByTxn.set(e.transactionId, (minutesByTxn.get(e.transactionId) ?? 0) + e.minutes);
    }

    const files: FileTime[] = [...minutesByTxn.entries()].flatMap(([id, minutes]) => {
      const t = byTxn.get(id);
      if (!t) return [];
      return [
        {
          transactionId: t.id,
          propertyAddress: t.propertyAddress,
          minutes,
          expectedFeeCents: t.expectedFeeCents,
          clientId: t.clientId,
          clientName: t.client?.name ?? null,
        },
      ];
    });

    return {
      files,
      people: timeByPerson(
        entries.map((e) => ({
          userId: e.userId,
          name: nameOf.get(e.userId) ?? "Someone",
          minutes: e.minutes,
          transactionId: e.transactionId,
        })),
      ),
      touches: entries.reduce((s, e) => s + e.touches, 0),
    };
  });

  const totals = timeTotals(data.files);
  const clients = timeByClient(data.files, 20);
  const efficient = efficientClients(data.files, 5);
  const rows = data.files
    .filter((f) => f.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .map((f) => ({ ...f, hourlyCents: effectiveHourlyCents(f.expectedFeeCents, f.minutes) }));

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Time on files</h1>
          <p className="mt-1 text-sm text-stone-500">
            What each file cost in hours, against what it bills. Recorded automatically while a
            transaction page is open.
          </p>
        </div>
        <RangeLinks active={range} />
      </div>

      {!org?.timeTrackingEnabled && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Time on files is switched off for this workspace, so nothing new is being recorded. Any
          figures below are from before it was turned off.{" "}
          <Link href="/dashboard/settings" className="font-medium underline">
            Turn it back on in Settings
          </Link>
          .
        </p>
      )}

      <SectionCard
        title="The window"
        icon={<Clock size={15} weight="fill" aria-hidden />}
        bodyClassName="p-0"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <Stat label={`Tracked in ${range} days`} value={fmtMinutes(totals.minutes)} />
          <Stat label="Files touched" value={String(totals.files)} />
          <Stat label="Average per file" value={fmtMinutes(totals.avgMinutesPerFile)} />
          <Stat
            label="Blended hourly"
            value={totals.hourlyCents ? fmtCents(totals.hourlyCents) : "—"}
            hint={totals.feeCents > 0 ? `on ${fmtCents(totals.feeCents)} of fees` : "no fees set"}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Every file"
        count={rows.length}
        tooltip="Time against fee on each file, worst rate first once sorted by hours."
        bodyClassName=""
      >
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">
            No time recorded in this window. Minutes accrue while a transaction page is open, so
            opening a file starts filling this in.
          </p>
        ) : (
          <div className={tableWrap}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>Property</th>
                  <th className={th}>Client</th>
                  <th className={`${th} text-right`}>Time</th>
                  <th className={`${th} text-right`}>Fee</th>
                  <th className={`${th} text-right`}>Effective hourly</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.transactionId} className={trHover}>
                    <td className={td}>
                      <AddressPill href={`/dashboard/transactions/${f.transactionId}`}>
                        {f.propertyAddress}
                      </AddressPill>
                    </td>
                    <td className={`${td} text-stone-600`}>
                      {f.clientId ? (
                        <Link
                          href={`/dashboard/clients/${f.clientId}`}
                          className="hover:text-brand-700 hover:underline"
                        >
                          {f.clientName}
                        </Link>
                      ) : (
                        <span className="text-stone-300">No client</span>
                      )}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{fmtMinutes(f.minutes)}</td>
                    <td className={`${td} text-right tabular-nums text-stone-600`}>
                      {f.expectedFeeCents ? fmtCents(f.expectedFeeCents) : "—"}
                    </td>
                    <td className={`${td} text-right font-medium tabular-nums`}>
                      {f.hourlyCents ? fmtCents(f.hourlyCents) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="By client"
          count={clients.length}
          tooltip="Total hours absorbed per client, across everyone on your team."
          bodyClassName=""
        >
          {clients.length === 0 ? (
            <p className="p-4 text-sm text-stone-400">No client time in this window.</p>
          ) : (
            <div className={tableWrap}>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Client</th>
                    <th className={`${th} text-right`}>Files</th>
                    <th className={`${th} text-right`}>Total</th>
                    <th className={`${th} text-right`}>Per file</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.clientId} className={trHover}>
                      <td className={td}>
                        <Link
                          href={`/dashboard/clients/${c.clientId}`}
                          className="text-brand-700 hover:underline"
                        >
                          {c.clientName}
                        </Link>
                      </td>
                      <td className={`${td} text-right tabular-nums text-stone-600`}>{c.files}</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtMinutes(c.minutes)}</td>
                      <td className={`${td} text-right tabular-nums text-stone-600`}>
                        {fmtMinutes(c.avgMinutesPerFile)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <div className="flex flex-col gap-4">
          <SectionCard
            title="Most efficient clients"
            tooltip="Least average time per file. The work worth having more of."
          >
            {efficient.length === 0 ? (
              <p className="text-sm text-stone-400">No client time in this window.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {efficient.map((c) => (
                  <li key={c.clientId} className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/dashboard/clients/${c.clientId}`}
                      className="min-w-0 truncate text-brand-700 hover:underline"
                    >
                      {c.clientName}
                    </Link>
                    <span className="shrink-0 tabular-nums text-stone-500">
                      {fmtMinutes(c.avgMinutesPerFile)}/file
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="By person"
            count={data.people.length}
            tooltip="Where the team's hours went. Shown here, not on the dashboard."
          >
            {data.people.length === 0 ? (
              <p className="text-sm text-stone-400">No time recorded in this window.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {data.people.map((p) => (
                  <li key={p.userId} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-stone-700">{p.name}</span>
                    <span className="shrink-0 tabular-nums text-stone-500">
                      {fmtMinutes(p.minutes)} · {p.files} file{p.files === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
