/**
 * Business-day math for date templates. Pure — no database, no tenant
 * context — the same discipline as `packages/workflows`: this only needs a
 * date and a holiday set, so it only takes a date and a holiday set.
 *
 * "Business day" means Monday–Friday and not a holiday. Holidays are the
 * eleven US federal observances, each individually toggleable per workspace
 * (`Organization.holidaySchedule`) — a lender's cutoff might respect all of
 * them, a title company's might not observe Columbus Day. All eleven are on
 * by default, matching "US Default" from the plan.
 */

export interface HolidayDef {
  key: string;
  label: string;
}

export const FEDERAL_HOLIDAYS: HolidayDef[] = [
  { key: "NEW_YEARS", label: "New Year's Day" },
  { key: "MLK", label: "Martin Luther King Jr. Day" },
  { key: "PRESIDENTS", label: "Presidents' Day" },
  { key: "MEMORIAL", label: "Memorial Day" },
  { key: "JUNETEENTH", label: "Juneteenth" },
  { key: "INDEPENDENCE", label: "Independence Day" },
  { key: "LABOR", label: "Labor Day" },
  { key: "COLUMBUS", label: "Columbus Day" },
  { key: "VETERANS", label: "Veterans Day" },
  { key: "THANKSGIVING", label: "Thanksgiving Day" },
  { key: "CHRISTMAS", label: "Christmas Day" },
];

const FEDERAL_HOLIDAY_KEYS = new Set(FEDERAL_HOLIDAYS.map((h) => h.key));

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** The nth (1-indexed) given weekday (0=Sun..6=Sat) in a month. */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = utcDate(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return utcDate(year, month, 1 + offset + (n - 1) * 7);
}

/** The last given weekday in a month. */
function lastWeekday(year: number, month: number, weekday: number): Date {
  const lastDay = utcDate(year, month + 1, 0);
  const offset = (lastDay.getUTCDay() - weekday + 7) % 7;
  return utcDate(year, month, lastDay.getUTCDate() - offset);
}

/** A fixed federal date, shifted to the nearest weekday when it falls on a weekend. */
function observedFixed(year: number, month: number, day: number): Date {
  const d = utcDate(year, month, day);
  if (d.getUTCDay() === 6) return utcDate(year, month, day - 1); // Sat -> Fri
  if (d.getUTCDay() === 0) return utcDate(year, month, day + 1); // Sun -> Mon
  return d;
}

/** Every enabled federal holiday's observed date for one calendar year. */
function holidayDatesForYear(year: number, enabled: ReadonlySet<string>): Date[] {
  const dates: Array<[string, Date]> = [
    ["NEW_YEARS", observedFixed(year, 0, 1)],
    ["MLK", nthWeekday(year, 0, 1, 3)],
    ["PRESIDENTS", nthWeekday(year, 1, 1, 3)],
    ["MEMORIAL", lastWeekday(year, 4, 1)],
    ["JUNETEENTH", observedFixed(year, 5, 19)],
    ["INDEPENDENCE", observedFixed(year, 6, 4)],
    ["LABOR", nthWeekday(year, 8, 1, 1)],
    ["COLUMBUS", nthWeekday(year, 9, 1, 2)],
    ["VETERANS", observedFixed(year, 10, 11)],
    ["THANKSGIVING", nthWeekday(year, 10, 4, 4)],
    ["CHRISTMAS", observedFixed(year, 11, 25)],
  ];
  return dates.filter(([key]) => enabled.has(key)).map(([, d]) => d);
}

/** A workspace's chosen holiday set. `null` (never configured) means every federal holiday. */
export function enabledHolidayKeys(schedule: unknown): Set<string> {
  if (
    schedule &&
    typeof schedule === "object" &&
    Array.isArray((schedule as { enabled?: unknown }).enabled)
  ) {
    const list = (schedule as { enabled: unknown[] }).enabled.filter(
      (k): k is string => typeof k === "string" && FEDERAL_HOLIDAY_KEYS.has(k),
    );
    return new Set(list);
  }
  return new Set(FEDERAL_HOLIDAY_KEYS);
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Build the lookup `isBusinessDay` needs, spanning the years an offset might touch. */
export function holidaySetAround(
  date: Date,
  enabled: ReadonlySet<string>,
  spanYears = 2,
): Set<string> {
  const year = date.getUTCFullYear();
  const keys = new Set<string>();
  for (let y = year - spanYears; y <= year + spanYears; y++) {
    for (const d of holidayDatesForYear(y, enabled)) keys.add(dayKey(d));
  }
  return keys;
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function isBusinessDay(date: Date, holidays: ReadonlySet<string>): boolean {
  return !isWeekend(date) && !holidays.has(dayKey(date));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

/** Step forward (or backward) a fixed count of business days. */
export function addBusinessDays(date: Date, count: number, holidays: ReadonlySet<string>): Date {
  let d = date;
  const step = count >= 0 ? 1 : -1;
  let remaining = Math.abs(count);
  while (remaining > 0) {
    d = addUtcDays(d, step);
    if (isBusinessDay(d, holidays)) remaining--;
  }
  return d;
}

/** Roll forward to the nearest business day, or return the date unchanged if it already is one. */
export function nextBusinessDayOnOrAfter(date: Date, holidays: ReadonlySet<string>): Date {
  let d = date;
  while (!isBusinessDay(d, holidays)) d = addUtcDays(d, 1);
  return d;
}

/** Roll backward to the nearest business day, or return the date unchanged if it already is one. */
export function previousBusinessDayOnOrBefore(date: Date, holidays: ReadonlySet<string>): Date {
  let d = date;
  while (!isBusinessDay(d, holidays)) d = addUtcDays(d, -1);
  return d;
}

export const DATE_CALCULATORS = [
  "BUSINESS_DAYS",
  "CALENDAR_NEXT_BUSINESS_DAY",
  "CALENDAR_PREV_BUSINESS_DAY",
] as const;
export type DateCalculator = (typeof DATE_CALCULATORS)[number];

/**
 * Resolve one date-template item's suggested value.
 *
 * `calculator` null/unrecognized means plain calendar-day addition — the
 * schema's own doc comment on `DateTemplateItem.calculator` says so, and
 * that's the fallback every caller gets for free by not passing one.
 */
export function resolveCalculatedDate(
  anchor: Date,
  offsetDays: number,
  calculator: string | null,
  holidays: ReadonlySet<string>,
): Date {
  switch (calculator) {
    case "BUSINESS_DAYS":
      return addBusinessDays(anchor, offsetDays, holidays);
    case "CALENDAR_NEXT_BUSINESS_DAY":
      return nextBusinessDayOnOrAfter(addUtcDays(anchor, offsetDays), holidays);
    case "CALENDAR_PREV_BUSINESS_DAY":
      return previousBusinessDayOnOrBefore(addUtcDays(anchor, offsetDays), holidays);
    default:
      return addUtcDays(anchor, offsetDays);
  }
}
