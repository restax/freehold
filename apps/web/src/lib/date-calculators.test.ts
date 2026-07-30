import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  enabledHolidayKeys,
  holidaySetAround,
  isBusinessDay,
  isWeekend,
  nextBusinessDayOnOrAfter,
  previousBusinessDayOnOrBefore,
  resolveCalculatedDate,
} from "./date-calculators.js";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (dt: Date) => dt.toISOString().slice(0, 10);
const allHolidays = enabledHolidayKeys(null);

describe("enabledHolidayKeys", () => {
  it("defaults to every federal holiday when never configured", () => {
    expect(enabledHolidayKeys(null).size).toBe(11);
  });

  it("honors a workspace's chosen subset", () => {
    const set = enabledHolidayKeys({ enabled: ["CHRISTMAS", "NEW_YEARS"] });
    expect([...set].sort()).toEqual(["CHRISTMAS", "NEW_YEARS"]);
  });

  it("drops unrecognized keys rather than trusting stored garbage", () => {
    const set = enabledHolidayKeys({ enabled: ["CHRISTMAS", "MADE_UP_HOLIDAY"] });
    expect([...set]).toEqual(["CHRISTMAS"]);
  });

  it("treats a malformed value the same as unconfigured", () => {
    expect(enabledHolidayKeys("nonsense").size).toBe(11);
    expect(enabledHolidayKeys({}).size).toBe(11);
  });
});

describe("isWeekend", () => {
  it("flags Saturday and Sunday", () => {
    expect(isWeekend(d("2026-08-01"))).toBe(true); // Saturday
    expect(isWeekend(d("2026-08-02"))).toBe(true); // Sunday
  });
  it("does not flag a weekday", () => {
    expect(isWeekend(d("2026-08-03"))).toBe(false); // Monday
  });
});

describe("holidaySetAround + isBusinessDay — 2026 federal calendar", () => {
  const holidays = holidaySetAround(d("2026-01-01"), allHolidays);

  it("observes New Year's Day 2026 (a Thursday) on its actual date", () => {
    expect(isBusinessDay(d("2026-01-01"), holidays)).toBe(false);
  });

  it("shifts a Saturday holiday to the preceding Friday (Independence Day 2026)", () => {
    // July 4, 2026 is a Saturday; the holiday closes Friday July 3 as well.
    expect(isBusinessDay(d("2026-07-03"), holidays)).toBe(false);
  });

  it("places MLK Day on the third Monday of January 2026", () => {
    expect(isBusinessDay(d("2026-01-19"), holidays)).toBe(false);
  });

  it("places Thanksgiving on the fourth Thursday of November 2026", () => {
    expect(isBusinessDay(d("2026-11-26"), holidays)).toBe(false);
  });

  it("treats an ordinary Tuesday as a business day", () => {
    expect(isBusinessDay(d("2026-08-04"), holidays)).toBe(true);
  });

  it("excludes a disabled holiday from the set", () => {
    const noColumbus = holidaySetAround(d("2026-01-01"), enabledHolidayKeys({ enabled: [] }));
    expect(isBusinessDay(d("2026-10-12"), noColumbus)).toBe(true); // Columbus Day 2026
  });
});

describe("addBusinessDays", () => {
  const holidays = holidaySetAround(d("2026-01-01"), allHolidays);

  it("skips a weekend in between", () => {
    // Friday 2026-07-31 + 1 business day = Monday 2026-08-03.
    expect(iso(addBusinessDays(d("2026-07-31"), 1, holidays))).toBe("2026-08-03");
  });

  it("skips a holiday in between", () => {
    // Wednesday 2026-11-25 + 1 business day skips Thanksgiving (Thu) -> Friday.
    expect(iso(addBusinessDays(d("2026-11-25"), 1, holidays))).toBe("2026-11-27");
  });

  it("counts backward for a negative offset", () => {
    expect(iso(addBusinessDays(d("2026-08-03"), -1, holidays))).toBe("2026-07-31");
  });

  it("returns the same date for a zero offset", () => {
    expect(iso(addBusinessDays(d("2026-08-04"), 0, holidays))).toBe("2026-08-04");
  });
});

describe("nextBusinessDayOnOrAfter / previousBusinessDayOnOrBefore", () => {
  const holidays = holidaySetAround(d("2026-01-01"), allHolidays);

  it("leaves a business day unchanged", () => {
    expect(iso(nextBusinessDayOnOrAfter(d("2026-08-04"), holidays))).toBe("2026-08-04");
    expect(iso(previousBusinessDayOnOrBefore(d("2026-08-04"), holidays))).toBe("2026-08-04");
  });

  it("rolls a Saturday forward to Monday", () => {
    expect(iso(nextBusinessDayOnOrAfter(d("2026-08-01"), holidays))).toBe("2026-08-03");
  });

  it("rolls a Sunday backward to Friday", () => {
    expect(iso(previousBusinessDayOnOrBefore(d("2026-08-02"), holidays))).toBe("2026-07-31");
  });
});

describe("resolveCalculatedDate", () => {
  const holidays = holidaySetAround(d("2026-01-01"), allHolidays);

  it("adds plain calendar days when calculator is null", () => {
    expect(iso(resolveCalculatedDate(d("2026-07-30"), 3, null, holidays))).toBe("2026-08-02");
  });

  it("treats an unrecognized calculator the same as calendar days", () => {
    expect(iso(resolveCalculatedDate(d("2026-07-30"), 3, "SOMETHING_ELSE", holidays))).toBe(
      "2026-08-02",
    );
  });

  it("counts business days when calculator is BUSINESS_DAYS", () => {
    expect(iso(resolveCalculatedDate(d("2026-07-31"), 1, "BUSINESS_DAYS", holidays))).toBe(
      "2026-08-03",
    );
  });

  it("snaps forward onto the next business day", () => {
    // Landing on Saturday 2026-08-01, rolled to Monday 2026-08-03.
    expect(
      iso(resolveCalculatedDate(d("2026-07-30"), 2, "CALENDAR_NEXT_BUSINESS_DAY", holidays)),
    ).toBe("2026-08-03");
  });

  it("snaps backward onto the previous business day", () => {
    // Landing on Sunday 2026-08-02, rolled back to Friday 2026-07-31.
    expect(
      iso(resolveCalculatedDate(d("2026-07-30"), 3, "CALENDAR_PREV_BUSINESS_DAY", holidays)),
    ).toBe("2026-07-31");
  });
});
