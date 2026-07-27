import { describe, expect, it } from "vitest";
import { consolidatedDueToday, consolidationLabel, todayParts } from "./billing-cadence";

describe("consolidatedDueToday", () => {
  it("monthly bills on the 1st only", () => {
    expect(consolidatedDueToday("monthly", { weekday: "Tue", dayOfMonth: 1 })).toBe(true);
    expect(consolidatedDueToday("monthly", { weekday: "Mon", dayOfMonth: 2 })).toBe(false);
  });

  it("weekly bills on Mondays only", () => {
    expect(consolidatedDueToday("weekly", { weekday: "Mon", dayOfMonth: 15 })).toBe(true);
    expect(consolidatedDueToday("weekly", { weekday: "Tue", dayOfMonth: 15 })).toBe(false);
  });

  it("per-file and upfront rhythms never schedule", () => {
    for (const mode of ["per_file_close", "per_file_entry", "upfront_full", "upfront_deposit"]) {
      expect(consolidatedDueToday(mode, { weekday: "Mon", dayOfMonth: 1 })).toBe(false);
    }
  });
});

describe("todayParts", () => {
  it("computes weekday and day in the tenant's zone, not the server's", () => {
    // 2026-08-01 01:00 UTC is still July 31 (Fri) in Chicago, already Aug 1 (Sat) in Tokyo.
    const now = new Date("2026-08-01T01:00:00Z");
    expect(todayParts(now, "America/Chicago")).toEqual({ weekday: "Fri", dayOfMonth: 31 });
    expect(todayParts(now, "Asia/Tokyo")).toEqual({ weekday: "Sat", dayOfMonth: 1 });
  });
});

describe("consolidationLabel", () => {
  it("names the period that just ended", () => {
    const aug1 = new Date("2026-08-01T12:00:00Z");
    expect(consolidationLabel("monthly", aug1, "America/Chicago")).toBe(
      "Monthly invoice — July 2026",
    );
    const mon = new Date("2026-07-27T12:00:00Z"); // Monday
    expect(consolidationLabel("weekly", mon, "America/Chicago")).toBe(
      "Weekly invoice — week ending 2026-07-26",
    );
  });
});
