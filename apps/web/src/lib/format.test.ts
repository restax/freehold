import { describe, expect, it } from "vitest";
import { fmtDate, fmtDayMonth } from "./format";

const at = (iso: string) => new Date(iso);

describe("fmtDayMonth", () => {
  const now = at("2026-07-30T00:00:00.000Z");

  it("drops the year within the current year", () => {
    expect(fmtDayMonth(at("2026-07-30T00:00:00.000Z"), now)).toBe("Jul 30");
    expect(fmtDayMonth(at("2026-01-05T00:00:00.000Z"), now)).toBe("Jan 5");
    expect(fmtDayMonth(at("2026-12-31T00:00:00.000Z"), now)).toBe("Dec 31");
  });

  it("keeps the year on any other year", () => {
    // The case dropping it entirely would get wrong: a closing next January
    // reading as a bare "Jan 5" looks like six months overdue, not upcoming.
    expect(fmtDayMonth(at("2027-01-05T00:00:00.000Z"), now)).toBe("Jan 5, 2027");
    expect(fmtDayMonth(at("2025-11-02T00:00:00.000Z"), now)).toBe("Nov 2, 2025");
  });

  it("reads the date in UTC, not local time", () => {
    // Dates are stored at UTC midnight. Reading them locally slides them a day
    // backwards anywhere west of UTC — and forwards nowhere useful — so a
    // deadline saved as the 30th must never render as the 29th.
    expect(fmtDayMonth(at("2026-07-30T00:00:00.000Z"), now)).toBe("Jul 30");
    // Same instant, expressed from a zone well ahead of UTC.
    expect(fmtDayMonth(at("2026-07-30T09:00:00+09:00"), now)).toBe("Jul 30");
  });

  it("agrees with fmtDate about which day it is", () => {
    // The two run side by side on the same page; they must never disagree.
    for (const iso of [
      "2026-01-01T00:00:00.000Z",
      "2026-07-30T00:00:00.000Z",
      "2026-12-31T00:00:00.000Z",
    ]) {
      const d = at(iso);
      const [, month, day] = fmtDate(d).split("-");
      expect(fmtDayMonth(d, now)).toContain(String(Number(day)));
      expect(fmtDayMonth(d, now).startsWith(fmtDayMonth(d, now).slice(0, 3))).toBe(true);
      expect(Number(month)).toBe(d.getUTCMonth() + 1);
    }
  });

  it("renders an em dash for no date, like fmtDate", () => {
    expect(fmtDayMonth(null, now)).toBe("—");
    expect(fmtDayMonth(undefined, now)).toBe("—");
  });

  it("defaults to the current clock when no now is given", () => {
    const thisYear = new Date();
    expect(fmtDayMonth(thisYear)).not.toContain(",");
  });
});
