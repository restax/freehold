import Link from "next/link";
import {
  type Bucket,
  CHART_RANGES,
  type ChartRange,
  type ClientVolume,
  peak,
} from "@/lib/dashboard-charts";

/**
 * The dashboard's two small charts.
 *
 * Plain divs, no charting library. At this size — a column bar chart about
 * 40px tall in a sidebar — a library buys nothing but bundle weight and a
 * canvas that can't be read by a screen reader or selected as text. Every bar
 * carries its own number in a title attribute, so the exact figure is one
 * hover away without a tooltip layer.
 */

/** The 7 / 30 / 90 switch. A link, not a button: the range lives in the URL,
 *  so the choice survives a refresh and can be linked to, and the page stays
 *  a server component with no client bundle. */
export function RangeSwitch({ active }: { active: ChartRange }) {
  return (
    <div className="flex items-center gap-1">
      {CHART_RANGES.map((r) => (
        <Link
          key={r}
          href={`/dashboard?range=${r}`}
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

/** New files opened per bucket, oldest on the left. */
export function VolumeChart({ buckets, range }: { buckets: Bucket[]; range: ChartRange }) {
  const max = peak(buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{total}</span>
        <span className="text-xs text-stone-500">
          new file{total === 1 ? "" : "s"} in {range} days
        </span>
      </div>

      <div className="mt-3 flex h-16 items-end gap-[3px]">
        {buckets.map((b) => (
          <div
            key={b.start.toISOString()}
            title={`${b.label} — ${b.count} file${b.count === 1 ? "" : "s"}`}
            className="flex-1 rounded-sm bg-brand-600/80 transition-colors hover:bg-brand-700"
            // A zero bar keeps a 2px stub rather than disappearing: an empty
            // period should read as "nothing happened", not as a gap in the
            // chart where an axis ought to be.
            style={{ height: `${Math.max(2, Math.round((b.count / max) * 100))}%` }}
          />
        ))}
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-stone-400">
        <span>{buckets[0]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/** Who sent the most work in the window. */
export function TopClientsChart({
  clients,
  range,
}: {
  clients: ClientVolume[];
  range: ChartRange;
}) {
  const max = peak(clients.map((c) => c.count));

  if (clients.length === 0) {
    return (
      <p className="text-sm text-stone-400">
        No files opened for a client in the last {range} days.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {clients.map((c) => (
        <li key={c.id}>
          <div className="flex items-baseline justify-between gap-2">
            <Link
              href={`/dashboard/clients/${c.id}`}
              className="min-w-0 truncate text-sm text-brand-700 hover:underline"
            >
              {c.name}
            </Link>
            <span className="shrink-0 text-xs tabular-nums text-stone-500">{c.count}</span>
          </div>
          {/* Horizontal here, vertical above: these are a ranking rather than
              a series, and a bar you read left-to-right beside a name is
              easier to compare than columns you read bottom-up. */}
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-brand-600/80"
              style={{ width: `${Math.round((c.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
