/**
 * "Time on files" — the maths behind the passive time ledger.
 *
 * Pure and tested. The ledger itself is one row per (file, person, day),
 * accrued by /api/time/ping while a transaction page is open and visible.
 * Everything here shapes those rows into the three dashboard views: what a
 * file costs against what it bills, which clients absorb the most time, and
 * which clients are the most efficient per file.
 */

/** A ping only adds a minute when the last accepted one is at least this old,
 *  so two open tabs (or a reconnecting network) can't double-count a minute. */
export const PING_MIN_GAP_MS = 50_000;

/** How often the page pings while open and visible. */
export const PING_INTERVAL_MS = 60_000;

export function shouldCountPing(lastPingAt: Date, now: Date): boolean {
  return now.getTime() - lastPingAt.getTime() >= PING_MIN_GAP_MS;
}

/** The UTC day a ping lands on, matching the UTC-day convention used by the
 *  dashboard's other charts (see lib/dashboard-charts.ts). */
export function utcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** "45m", "3h 05m" — minutes are the ledger's unit, hours are how people read them. */
export function fmtMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Effective hourly rate in cents, or null when there's nothing to divide.
 *  This is the number the whole feature exists to surface: fee ÷ time. */
export function effectiveHourlyCents(feeCents: number | null, minutes: number): number | null {
  if (feeCents == null || feeCents <= 0 || minutes <= 0) return null;
  return Math.round((feeCents / minutes) * 60);
}

/** Per-transaction rollup as read from the ledger (already summed per file). */
export interface FileTime {
  transactionId: string;
  propertyAddress: string;
  minutes: number;
  expectedFeeCents: number | null;
  clientId: string | null;
  clientName: string | null;
}

export interface FileTimeRow extends FileTime {
  hourlyCents: number | null;
}

/** Files ranked by time spent, each with its effective hourly — the
 *  "time vs. fee" view. Untracked files (0 minutes) are noise, not data. */
export function timeVsFee(files: FileTime[], limit = 6): FileTimeRow[] {
  return files
    .filter((f) => f.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, limit)
    .map((f) => ({ ...f, hourlyCents: effectiveHourlyCents(f.expectedFeeCents, f.minutes) }));
}

export interface ClientTime {
  clientId: string;
  clientName: string;
  minutes: number;
  files: number;
  avgMinutesPerFile: number;
}

function rollupByClient(files: FileTime[]): ClientTime[] {
  const byClient = new Map<string, ClientTime>();
  for (const f of files) {
    if (!f.clientId || f.minutes <= 0) continue;
    const cur = byClient.get(f.clientId) ?? {
      clientId: f.clientId,
      clientName: f.clientName ?? "Client",
      minutes: 0,
      files: 0,
      avgMinutesPerFile: 0,
    };
    cur.minutes += f.minutes;
    cur.files += 1;
    byClient.set(f.clientId, cur);
  }
  for (const c of byClient.values()) c.avgMinutesPerFile = Math.round(c.minutes / c.files);
  return [...byClient.values()];
}

/** Clients ranked by total time absorbed across every user — where the
 *  workspace's hours actually go. */
export function timeByClient(files: FileTime[], limit = 5): ClientTime[] {
  return rollupByClient(files)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, limit);
}

/** Clients ranked by least average time per file — the ones whose work is
 *  the most profitable per hour of yours it consumes. A single tracked file
 *  is allowed on purpose: with fresh data, one file is all anyone has. */
export function efficientClients(files: FileTime[], limit = 5): ClientTime[] {
  return rollupByClient(files)
    .sort((a, b) => a.avgMinutesPerFile - b.avgMinutesPerFile)
    .slice(0, limit);
}

export interface PersonTime {
  userId: string;
  name: string;
  minutes: number;
  files: number;
}

/** Who spent the hours. Used only on the report, never on the dashboard: the
 *  feature is sold as file-cost analytics, and a per-person column on the
 *  Today page would quietly turn it into a scoreboard. On a report an owner
 *  opened deliberately, capacity is a fair question. */
export function timeByPerson(
  rows: Array<{ userId: string; name: string; minutes: number; transactionId: string }>,
  limit = 10,
): PersonTime[] {
  const byUser = new Map<string, PersonTime & { seen: Set<string> }>();
  for (const r of rows) {
    if (r.minutes <= 0) continue;
    const cur = byUser.get(r.userId) ?? {
      userId: r.userId,
      name: r.name,
      minutes: 0,
      files: 0,
      seen: new Set<string>(),
    };
    cur.minutes += r.minutes;
    cur.seen.add(r.transactionId);
    byUser.set(r.userId, cur);
  }
  return [...byUser.values()]
    .map(({ seen, ...p }) => ({ ...p, files: seen.size }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, limit);
}

export interface TimeTotals {
  minutes: number;
  files: number;
  feeCents: number;
  /** Blended rate across every file that has both time and a fee. */
  hourlyCents: number | null;
  avgMinutesPerFile: number;
}

/** The headline row on the report: what the whole window came to. */
export function timeTotals(files: FileTime[]): TimeTotals {
  const tracked = files.filter((f) => f.minutes > 0);
  const minutes = tracked.reduce((s, f) => s + f.minutes, 0);
  // Only files carrying a fee count toward the blended rate; including a
  // no-fee file would drag it toward zero and read as a pricing problem
  // rather than a missing number.
  const billable = tracked.filter((f) => (f.expectedFeeCents ?? 0) > 0);
  const feeCents = billable.reduce((s, f) => s + (f.expectedFeeCents ?? 0), 0);
  const billableMinutes = billable.reduce((s, f) => s + f.minutes, 0);
  return {
    minutes,
    files: tracked.length,
    feeCents,
    hourlyCents: effectiveHourlyCents(feeCents, billableMinutes),
    avgMinutesPerFile: tracked.length === 0 ? 0 : Math.round(minutes / tracked.length),
  };
}
