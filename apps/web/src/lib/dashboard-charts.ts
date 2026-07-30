/**
 * The maths behind the dashboard's two small charts.
 *
 * Pure and tested, because bucketing by date is the kind of thing that looks
 * right on today's data and is quietly off by one for anyone in a timezone
 * behind UTC, or on the day a month rolls over. Everything works in UTC days,
 * matching `fmtDate`/`fmtDayMonth` elsewhere in the app.
 */

/** The windows the range buttons offer. */
export const CHART_RANGES = [7, 30, 90] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export function parseRange(raw: string | undefined): ChartRange {
  // Exact match, not parseInt: that would read "7; drop table" as 7. Harmless
  // here (the value is only ever arithmetic) but there is no reason for a URL
  // to smuggle anything past this.
  const hit = CHART_RANGES.find((r) => String(r) === raw);
  return hit ?? 30;
}

export interface Bucket {
  /** Start of the bucket, for the tooltip and the key. */
  start: Date;
  label: string;
  count: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * How many days each bar covers, so a chart never has more bars than it has
 * room for. 7 days reads as one bar a day; 90 would be unreadable that way, so
 * it becomes ~13 weekly bars.
 */
export function bucketSize(range: ChartRange): number {
  if (range <= 7) return 1;
  if (range <= 30) return 3;
  return 7;
}

/**
 * Group timestamps into evenly-spaced buckets ending today.
 *
 * Buckets are built from the range rather than from the data, so a quiet
 * fortnight shows as a run of empty bars instead of silently collapsing the
 * axis — the gap is the information.
 */
export function bucketByDay(dates: Date[], range: ChartRange, now: Date): Bucket[] {
  const size = bucketSize(range);
  const count = Math.ceil(range / size);
  const today = utcDay(now);
  const dayMs = 24 * 3600 * 1000;

  const buckets: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    // Each bucket covers [start, start + size) days, the last ending today.
    const start = new Date(today - (i * size + size - 1) * dayMs);
    buckets.push({
      start,
      label: `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`,
      count: 0,
    });
  }

  for (const d of dates) {
    const daysAgo = Math.floor((today - utcDay(d)) / dayMs);
    if (daysAgo < 0 || daysAgo >= count * size) continue;
    const idx = count - 1 - Math.floor(daysAgo / size);
    if (idx >= 0 && idx < buckets.length) buckets[idx].count++;
  }

  return buckets;
}

export interface ClientVolume {
  id: string;
  name: string;
  count: number;
}

/**
 * Clients ranked by how much work they sent in the window.
 *
 * "Best" deliberately means volume rather than revenue: a coordinator's
 * question here is who keeps them busy, and revenue on a file often isn't
 * settled until long after it closes, so ranking by it would mostly rank by
 * how promptly people pay.
 */
export function topClients(
  files: Array<{ clientId: string | null; clientName: string | null }>,
  limit = 5,
): ClientVolume[] {
  const byId = new Map<string, ClientVolume>();
  for (const f of files) {
    if (!f.clientId) continue;
    const row = byId.get(f.clientId) ?? {
      id: f.clientId,
      name: f.clientName ?? "Unnamed client",
      count: 0,
    };
    row.count++;
    byId.set(f.clientId, row);
  }
  return [...byId.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** The tallest bar, used to scale the rest. Never zero, so a chart with no
 *  data renders a flat baseline rather than dividing by nothing. */
export function peak(values: number[]): number {
  return Math.max(1, ...values);
}
