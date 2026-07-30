import { describe, expect, it } from "vitest";
import {
  businessDaysBetween,
  calendarDaysBetween,
  DEFAULT_ALERT_CONFIG,
  resolveAlertConfig,
  staleness,
  stalenessMessage,
  upcomingCriticalDates,
  urgentOpenTasks,
} from "./transaction-alerts";

/** Local-midnight date, matching how the module normalizes everything. */
const d = (iso: string) => {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day);
};

// 2026-07-20 is a Monday; 07-25 Saturday, 07-26 Sunday, 07-27 Monday.
describe("businessDaysBetween", () => {
  it("counts consecutive weekdays", () => {
    expect(businessDaysBetween(d("2026-07-20"), d("2026-07-21"))).toBe(1);
    expect(businessDaysBetween(d("2026-07-20"), d("2026-07-23"))).toBe(3);
  });

  it("skips the weekend — Friday to Monday is one business day", () => {
    expect(businessDaysBetween(d("2026-07-24"), d("2026-07-27"))).toBe(1);
  });

  it("counts a full week as five", () => {
    expect(businessDaysBetween(d("2026-07-20"), d("2026-07-27"))).toBe(5);
  });

  it("is zero for the same day or a future start", () => {
    expect(businessDaysBetween(d("2026-07-20"), d("2026-07-20"))).toBe(0);
    expect(businessDaysBetween(d("2026-07-22"), d("2026-07-20"))).toBe(0);
  });

  it("ignores the time of day on either side", () => {
    const fri = new Date(2026, 6, 24, 23, 59);
    const mon = new Date(2026, 6, 27, 0, 1);
    expect(businessDaysBetween(fri, mon)).toBe(1);
  });

  it("counts weekend-to-weekend without inventing days", () => {
    // Saturday to the following Saturday: Mon–Fri only.
    expect(businessDaysBetween(d("2026-07-25"), d("2026-08-01"))).toBe(5);
  });
});

describe("calendarDaysBetween", () => {
  it("counts calendar days and goes negative for the past", () => {
    expect(calendarDaysBetween(d("2026-07-20"), d("2026-07-27"))).toBe(7);
    expect(calendarDaysBetween(d("2026-07-27"), d("2026-07-20"))).toBe(-7);
    expect(calendarDaysBetween(d("2026-07-20"), d("2026-07-20"))).toBe(0);
  });
});

describe("upcomingCriticalDates", () => {
  const today = d("2026-07-20");

  it("returns only dates inside the window, soonest first", () => {
    const out = upcomingCriticalDates(
      {
        closeDate: d("2026-07-26"),
        mortgageCommitmentDate: d("2026-07-22"),
        inspectionDeadlineDate: d("2026-09-01"), // outside the window
      },
      today,
      7,
    );
    expect(out.map((c) => c.kind)).toEqual(["mortgageCommitment", "close"]);
    expect(out[0].daysAway).toBe(2);
  });

  it("breaks same-day ties by priority: close > commitment > inspection", () => {
    const same = d("2026-07-23");
    const out = upcomingCriticalDates(
      { closeDate: same, mortgageCommitmentDate: same, inspectionDeadlineDate: same },
      today,
      7,
    );
    expect(out.map((c) => c.kind)).toEqual(["close", "mortgageCommitment", "inspectionDeadline"]);
  });

  it("drops dates already past", () => {
    const out = upcomingCriticalDates({ closeDate: d("2026-07-19") }, today, 7);
    expect(out).toEqual([]);
  });

  it("includes today (daysAway 0) and the window edge, excludes past the edge", () => {
    expect(upcomingCriticalDates({ closeDate: today }, today, 7)[0].daysAway).toBe(0);
    expect(upcomingCriticalDates({ closeDate: d("2026-07-27") }, today, 7)).toHaveLength(1);
    expect(upcomingCriticalDates({ closeDate: d("2026-07-28") }, today, 7)).toHaveLength(0);
  });

  it("ignores unset dates", () => {
    expect(upcomingCriticalDates({}, today, 7)).toEqual([]);
    expect(upcomingCriticalDates({ closeDate: null }, today, 7)).toEqual([]);
  });
});

describe("resolveAlertConfig", () => {
  it("falls back to defaults when unset or malformed", () => {
    expect(resolveAlertConfig(null)).toEqual(DEFAULT_ALERT_CONFIG);
    expect(resolveAlertConfig({})).toEqual(DEFAULT_ALERT_CONFIG);
    expect(resolveAlertConfig({ staleDays: "soon" })).toEqual(DEFAULT_ALERT_CONFIG);
  });

  it("applies partial overrides, leaving the rest at defaults", () => {
    expect(resolveAlertConfig({ staleDays: 1 })).toEqual({
      ...DEFAULT_ALERT_CONFIG,
      staleDays: 1,
    });
  });

  it("clamps out-of-range values rather than trusting them", () => {
    expect(resolveAlertConfig({ staleDays: 0 }).staleDays).toBe(1);
    expect(resolveAlertConfig({ staleDays: 9999 }).staleDays).toBe(60);
    expect(resolveAlertConfig({ criticalWindowDays: 0 }).criticalWindowDays).toBe(1);
  });
});

describe("staleness", () => {
  const config = { ...DEFAULT_ALERT_CONFIG };
  const base = { createdAt: d("2026-07-01"), config };

  it("is quiet-but-fine below the ordinary threshold", () => {
    const s = staleness({
      ...base,
      lastTouchedAt: d("2026-07-20"),
      today: d("2026-07-22"),
      dates: {},
    });
    expect(s.quietDays).toBe(2);
    expect(s.threshold).toBe(3);
    expect(s.stale).toBe(false);
  });

  it("flags at exactly the ordinary threshold", () => {
    const s = staleness({
      ...base,
      lastTouchedAt: d("2026-07-20"),
      today: d("2026-07-23"),
      dates: {},
    });
    expect(s.quietDays).toBe(3);
    expect(s.stale).toBe(true);
    expect(s.escalatedBy).toBeNull();
  });

  it("does not flag over a weekend that would trip a calendar-day rule", () => {
    // Touched Friday, checked Monday: 3 calendar days, 1 business day.
    const s = staleness({
      ...base,
      lastTouchedAt: d("2026-07-24"),
      today: d("2026-07-27"),
      dates: {},
    });
    expect(s.quietDays).toBe(1);
    expect(s.stale).toBe(false);
  });

  it("tightens to one day inside the critical window", () => {
    const s = staleness({
      ...base,
      lastTouchedAt: d("2026-07-20"),
      today: d("2026-07-21"),
      dates: { closeDate: d("2026-07-24") },
    });
    expect(s.quietDays).toBe(1);
    expect(s.threshold).toBe(1);
    expect(s.stale).toBe(true);
    expect(s.escalatedBy?.kind).toBe("close");
  });

  it("stays at the ordinary threshold when the critical date is beyond the window", () => {
    const s = staleness({
      ...base,
      lastTouchedAt: d("2026-07-20"),
      today: d("2026-07-21"),
      dates: { closeDate: d("2026-08-30") },
    });
    expect(s.threshold).toBe(3);
    expect(s.stale).toBe(false);
    expect(s.escalatedBy).toBeNull();
  });

  it("escalates on the nearest critical date when several are in the window", () => {
    const s = staleness({
      ...base,
      lastTouchedAt: d("2026-07-20"),
      today: d("2026-07-21"),
      dates: { closeDate: d("2026-07-27"), inspectionDeadlineDate: d("2026-07-22") },
    });
    expect(s.escalatedBy?.kind).toBe("inspectionDeadline");
    expect(s.upcoming).toHaveLength(2);
  });

  it("measures from creation when the file has never been touched", () => {
    const s = staleness({
      createdAt: d("2026-07-20"),
      config,
      lastTouchedAt: null,
      today: d("2026-07-23"),
      dates: {},
    });
    expect(s.quietDays).toBe(3);
    expect(s.stale).toBe(true);
  });

  it("honours a per-client override that wants alerts sooner", () => {
    const eager = { ...DEFAULT_ALERT_CONFIG, staleDays: 1 };
    const s = staleness({
      ...base,
      config: eager,
      lastTouchedAt: d("2026-07-20"),
      today: d("2026-07-21"),
      dates: {},
    });
    expect(s.stale).toBe(true);
  });

  it("honours a per-client override that wants alerts later", () => {
    const relaxed = { ...DEFAULT_ALERT_CONFIG, staleDays: 10 };
    const s = staleness({
      ...base,
      config: relaxed,
      lastTouchedAt: d("2026-07-20"),
      today: d("2026-07-23"),
      dates: {},
    });
    expect(s.stale).toBe(false);
  });
});

describe("stalenessMessage", () => {
  const config = { ...DEFAULT_ALERT_CONFIG };
  const base = { createdAt: d("2026-07-01"), config };

  it("reads plainly without a critical date", () => {
    const s = staleness({
      ...base,
      lastTouchedAt: d("2026-07-20"),
      today: d("2026-07-23"),
      dates: {},
    });
    expect(stalenessMessage(s)).toBe("No activity in 3 business days.");
  });

  it("names the critical date and how close it is", () => {
    const s = staleness({
      ...base,
      lastTouchedAt: d("2026-07-20"),
      today: d("2026-07-21"),
      dates: { closeDate: d("2026-07-24") },
    });
    expect(stalenessMessage(s)).toBe("No activity in 1 business day — closing in 3 days.");
  });

  it("says today and tomorrow rather than counting days", () => {
    const todayS = staleness({
      ...base,
      lastTouchedAt: d("2026-07-20"),
      today: d("2026-07-21"),
      dates: { closeDate: d("2026-07-21") },
    });
    expect(stalenessMessage(todayS)).toContain("closing today");

    const tomorrowS = staleness({
      ...base,
      lastTouchedAt: d("2026-07-20"),
      today: d("2026-07-21"),
      dates: { closeDate: d("2026-07-22") },
    });
    expect(stalenessMessage(tomorrowS)).toContain("closing tomorrow");
  });
});

// 2026-07-23 is a Thursday, 07-24 Friday, 07-27 the following Monday.
describe("urgentOpenTasks", () => {
  const task = (over: Partial<Parameters<typeof urgentOpenTasks>[0][number]> = {}) => ({
    id: "t1",
    title: "Mortgage commitment",
    dueDate: d("2026-07-27"),
    status: "OPEN",
    ...over,
  });

  it("flags a Monday due date starting Thursday — two business days out", () => {
    expect(urgentOpenTasks([task()], d("2026-07-23"))).toHaveLength(1);
  });

  it("does not flag it yet on Wednesday — three business days out", () => {
    expect(urgentOpenTasks([task()], d("2026-07-22"))).toHaveLength(0);
  });

  it("keeps flagging it on Friday and on the day itself", () => {
    expect(urgentOpenTasks([task()], d("2026-07-24"))).toHaveLength(1);
    expect(urgentOpenTasks([task()], d("2026-07-27"))).toHaveLength(1);
  });

  it("drops off once the due date has passed — that's the overdue list's job", () => {
    expect(urgentOpenTasks([task()], d("2026-07-28"))).toHaveLength(0);
  });

  it("ignores completed tasks — a finished task isn't a risk", () => {
    expect(urgentOpenTasks([task({ status: "DONE" })], d("2026-07-23"))).toHaveLength(0);
  });

  it("ignores tasks with no due date", () => {
    expect(urgentOpenTasks([task({ dueDate: null })], d("2026-07-23"))).toHaveLength(0);
  });

  it("sorts soonest first", () => {
    const soon = task({ id: "a", title: "Soon", dueDate: d("2026-07-24") });
    const later = task({ id: "b", title: "Later", dueDate: d("2026-07-27") });
    const result = urgentOpenTasks([later, soon], d("2026-07-23"));
    expect(result.map((t) => t.taskId)).toEqual(["a", "b"]);
  });

  it("reports both business and calendar days away", () => {
    const [t] = urgentOpenTasks([task()], d("2026-07-23"));
    expect(t.businessDaysAway).toBe(2);
    expect(t.calendarDaysAway).toBe(4);
  });
});
