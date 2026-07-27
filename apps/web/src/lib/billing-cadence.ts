/**
 * Pure cadence rules for scheduled consolidated billing — split from the
 * runner so they unit-test without dragging server modules along. All
 * date math is done in the *tenant's* time zone: a Tokyo workspace's "1st
 * of the month" is not a Chicago server's.
 */

/** Whether a rhythm bills today: monthly on the 1st, weekly on Mondays. */
export function consolidatedDueToday(
  mode: string,
  parts: { weekday: string; dayOfMonth: number },
): boolean {
  if (mode === "monthly") return parts.dayOfMonth === 1;
  if (mode === "weekly") return parts.weekday === "Mon";
  return false;
}

/** Today's weekday + day-of-month in the tenant's own time zone. */
export function todayParts(now: Date, timeZone: string): { weekday: string; dayOfMonth: number } {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
  const dayOfMonth = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, day: "numeric" }).format(now),
  );
  return { weekday, dayOfMonth };
}

/** "Monthly invoice — July 2026" / "Weekly invoice — week ending 2026-07-26": the period just ended. */
export function consolidationLabel(mode: string, now: Date, timeZone: string): string {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (mode === "monthly") {
    const month = new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "long",
      year: "numeric",
    }).format(yesterday);
    return `Monthly invoice — ${month}`;
  }
  const end = new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(yesterday);
  return `Weekly invoice — week ending ${end}`;
}
