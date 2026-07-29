import { describe, expect, it } from "vitest";
import {
  CLOSING_SOON_DAYS,
  closingSoonWindow,
  hasActiveFilters,
  isViewKey,
  multiParam,
  OPEN_STATUSES,
  searchTerm,
  startOfYear,
  type TransactionFilters,
  viewShape,
} from "./transaction-views";

describe("isViewKey", () => {
  it("accepts the real views and rejects anything else", () => {
    expect(isViewKey("mine-closing")).toBe(true);
    expect(isViewKey("all")).toBe(true);
    expect(isViewKey("nonsense")).toBe(false);
    expect(isViewKey(undefined)).toBe(false);
  });
});

describe("viewShape", () => {
  it("'all' filters nothing — it's the unfiltered pipeline", () => {
    expect(viewShape("all")).toEqual({
      statuses: [],
      mineOnly: false,
      hasOpenTasks: false,
      closingSoon: false,
      closedThisYear: false,
    });
  });

  it("'open' is live work only, not scoped to one person", () => {
    const s = viewShape("open");
    expect(s.statuses).toEqual(OPEN_STATUSES);
    expect(s.mineOnly).toBe(false);
  });

  it("every 'my' view scopes to the signed-in coordinator", () => {
    expect(viewShape("mine-pending").mineOnly).toBe(true);
    expect(viewShape("mine-closing").mineOnly).toBe(true);
    expect(viewShape("mine-closed-ytd").mineOnly).toBe(true);
  });

  it("pending means open files that still have something to do", () => {
    const s = viewShape("mine-pending");
    expect(s.hasOpenTasks).toBe(true);
    expect(s.statuses).toEqual(OPEN_STATUSES);
    // A pending-items view that also demanded a close date would hide files
    // that have work but no date yet — exactly the ones needing attention.
    expect(s.closingSoon).toBe(false);
  });

  it("closed-YTD looks at closed files only, within this year", () => {
    const s = viewShape("mine-closed-ytd");
    expect(s.statuses).toEqual(["CLOSED"]);
    expect(s.closedThisYear).toBe(true);
  });
});

describe("closingSoonWindow", () => {
  it("runs from today through N days out, inclusive", () => {
    const now = new Date(2026, 6, 29, 15, 30); // mid-afternoon
    const { gte, lte } = closingSoonWindow(now);
    // Starts at midnight so a file closing *today* is still included.
    expect(gte).toEqual(new Date(2026, 6, 29));
    expect(lte).toEqual(new Date(2026, 7, 12)); // +14 days
  });

  it("crosses a year boundary without breaking", () => {
    const { gte, lte } = closingSoonWindow(new Date(2026, 11, 28), 14);
    expect(gte).toEqual(new Date(2026, 11, 28));
    expect(lte).toEqual(new Date(2027, 0, 11));
  });

  it("defaults to the documented window", () => {
    expect(CLOSING_SOON_DAYS).toBe(14);
  });
});

describe("startOfYear", () => {
  it("is midnight Jan 1 of the year in question", () => {
    expect(startOfYear(new Date(2026, 6, 29))).toEqual(new Date(2026, 0, 1));
  });
});

describe("searchTerm", () => {
  it("trims and keeps a real term", () => {
    expect(searchTerm("  412 Maple  ")).toBe("412 Maple");
  });

  it("is null for blank input, so the caller skips the clause", () => {
    expect(searchTerm("")).toBeNull();
    expect(searchTerm("   ")).toBeNull();
    expect(searchTerm(undefined)).toBeNull();
    expect(searchTerm(null)).toBeNull();
  });

  it("caps absurd input rather than passing it to the database", () => {
    expect(searchTerm("x".repeat(500))?.length).toBe(200);
  });
});

describe("multiParam", () => {
  it("handles a single value, a repeated param, and a comma list alike", () => {
    expect(multiParam("CLOSED")).toEqual(["CLOSED"]);
    expect(multiParam(["A", "B"])).toEqual(["A", "B"]);
    expect(multiParam("A,B")).toEqual(["A", "B"]);
  });

  it("dedupes and drops empties", () => {
    expect(multiParam(["A", "A", "", "  ", "B"])).toEqual(["A", "B"]);
  });

  it("filters to an allow-list when given one — URL input is not trusted", () => {
    expect(multiParam(["CLOSED", "DROP TABLE"], ["CLOSED", "PENDING"])).toEqual(["CLOSED"]);
  });

  it("is empty for a missing param", () => {
    expect(multiParam(undefined)).toEqual([]);
  });
});

describe("hasActiveFilters", () => {
  const base: TransactionFilters = {
    view: "all",
    q: null,
    statuses: [],
    assigneeIds: [],
    clientIds: [],
  };

  it("is false for a bare view — the view alone isn't a filter to clear", () => {
    expect(hasActiveFilters(base)).toBe(false);
    expect(hasActiveFilters({ ...base, view: "mine-closing" })).toBe(false);
  });

  it("is true once any explicit filter is set", () => {
    expect(hasActiveFilters({ ...base, q: "maple" })).toBe(true);
    expect(hasActiveFilters({ ...base, statuses: ["CLOSED"] })).toBe(true);
    expect(hasActiveFilters({ ...base, assigneeIds: ["u1"] })).toBe(true);
    expect(hasActiveFilters({ ...base, clientIds: ["c1"] })).toBe(true);
  });
});
