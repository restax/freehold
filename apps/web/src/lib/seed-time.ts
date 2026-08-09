import type { TenantTx } from "@freehold/db";
import { addDaysUtc, utcToday } from "@/lib/seed-core";

/**
 * Plausible "time on files" history for seeded workspaces.
 *
 * A brand-new demo shows three empty panels otherwise, which is the worst
 * possible first impression of the feature it is meant to sell: the whole
 * pitch is that the numbers are already there without anyone doing anything.
 *
 * Deterministic on purpose. The minutes are derived from a hash of the
 * transaction id, so a reseed produces the same history and a screenshot
 * taken today still matches the demo next week. Nothing here is random.
 */

/** Stable 32-bit hash, so a given file always draws the same hours. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** A deterministic integer in [min, max], varied by `salt`. */
function pick(seed: string, salt: number, min: number, max: number): number {
  return min + (hash(`${seed}:${salt}`) % (max - min + 1));
}

export interface TimeSeedTarget {
  transactionId: string;
  /** Everyone who might have touched it. One id is fine. */
  userIds: string[];
  /**
   * Roughly how much attention this file has had. A file under contract for
   * weeks has a real history; a fresh listing has barely any.
   */
  weight: "heavy" | "normal" | "light";
}

const TOTAL_RANGE: Record<TimeSeedTarget["weight"], [number, number]> = {
  heavy: [240, 520],
  normal: [90, 240],
  light: [25, 85],
};

/**
 * Write per-(file, person, day) rows for each target.
 *
 * Minutes land on a handful of scattered weekdays in the recent past rather
 * than one lump, because that is what the panels are shaped to read and what
 * real usage looks like: a file gets touched, then left, then touched again.
 */
export async function seedTimeEntries(
  tx: TenantTx,
  tenantId: string,
  targets: TimeSeedTarget[],
): Promise<number> {
  const today = utcToday();
  const rows: Array<{
    tenantId: string;
    transactionId: string;
    userId: string;
    day: Date;
    minutes: number;
    touches: number;
    lastPingAt: Date;
  }> = [];

  for (const target of targets) {
    if (target.userIds.length === 0) continue;
    const seed = target.transactionId;
    const [lo, hi] = TOTAL_RANGE[target.weight];
    let remaining = pick(seed, 1, lo, hi);
    // Two to six working sessions, spread over the last three weeks.
    const sessions = pick(seed, 2, 2, 6);

    for (let s = 0; s < sessions && remaining > 0; s++) {
      const last = s === sessions - 1;
      // The final session soaks up whatever is left, so the per-file total
      // always matches the figure drawn above.
      const minutes = last
        ? remaining
        : Math.max(5, Math.min(remaining - 5, pick(seed, 10 + s, 10, 90)));
      const daysAgo = pick(seed, 20 + s, 1, 21);
      const day = addDaysUtc(today, -daysAgo);
      // Weekends look wrong on a work-time chart; nudge them to the Friday.
      const dow = day.getUTCDay();
      const workday = dow === 0 ? addDaysUtc(day, -2) : dow === 6 ? addDaysUtc(day, -1) : day;
      const userId = target.userIds[pick(seed, 30 + s, 0, target.userIds.length - 1)];

      rows.push({
        tenantId,
        transactionId: target.transactionId,
        userId,
        day: workday,
        minutes,
        // Roughly a touch every eight minutes of attention, floored at one.
        touches: Math.max(1, Math.round(minutes / 8)),
        lastPingAt: new Date(workday.getTime() + 15 * 3600 * 1000),
      });
      remaining -= minutes;
    }
  }

  // One row per (file, person, day) is a unique constraint, and two sessions
  // can land on the same day for the same person. Merge before writing rather
  // than letting createMany skip them, which would lose those minutes.
  const merged = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const key = `${r.transactionId}:${r.userId}:${r.day.toISOString()}`;
    const existing = merged.get(key);
    if (existing) {
      existing.minutes += r.minutes;
      existing.touches += r.touches;
    } else {
      merged.set(key, { ...r });
    }
  }

  const data = [...merged.values()];
  if (data.length === 0) return 0;
  await tx.transactionTimeEntry.createMany({ data, skipDuplicates: true });
  return data.length;
}
