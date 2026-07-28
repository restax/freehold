import { describe, expect, it } from "vitest";
import {
  businessAverage,
  clampRating,
  coordinatorStandings,
  reviewDue,
  reviewLinkUsable,
} from "./reviews";

const day = 24 * 60 * 60 * 1000;

describe("reviewDue", () => {
  it("is not due before the delay has passed", () => {
    const closed = new Date("2026-07-27T00:00:00Z");
    expect(reviewDue(closed, 3, new Date(closed.getTime() + 2 * day))).toBe(false);
  });

  it("is due once the delay has passed", () => {
    const closed = new Date("2026-07-27T00:00:00Z");
    expect(reviewDue(closed, 3, new Date(closed.getTime() + 3 * day))).toBe(true);
    expect(reviewDue(closed, 3, new Date(closed.getTime() + 30 * day))).toBe(true);
  });
});

describe("reviewLinkUsable", () => {
  const base = { expiresAt: new Date("2026-08-01T00:00:00Z"), revokedAt: null, answeredAt: null };

  it("is usable before expiry, unrevoked, unanswered", () => {
    expect(reviewLinkUsable(base, new Date("2026-07-28T00:00:00Z"))).toBe(true);
  });

  it("is not usable once expired", () => {
    expect(reviewLinkUsable(base, new Date("2026-08-02T00:00:00Z"))).toBe(false);
  });

  it("is not usable once revoked", () => {
    expect(reviewLinkUsable({ ...base, revokedAt: new Date() })).toBe(false);
  });

  it("is not usable once answered — one shot, not editable", () => {
    expect(reviewLinkUsable({ ...base, answeredAt: new Date() })).toBe(false);
  });
});

describe("clampRating", () => {
  it("parses a form string into an integer 1-5", () => {
    expect(clampRating("4")).toBe(4);
  });

  it("clamps out-of-range input rather than rejecting it", () => {
    expect(clampRating("9")).toBe(5);
    expect(clampRating("0")).toBe(1);
    expect(clampRating("-3")).toBe(1);
  });

  it("is null for garbage", () => {
    expect(clampRating("")).toBeNull();
    expect(clampRating("not a number")).toBeNull();
    expect(clampRating(null)).toBeNull();
  });
});

describe("businessAverage", () => {
  it("averages only the answered business ratings", () => {
    const reviews = [
      { businessRating: 5, coordinatorRating: null, coordinatorId: null, coordinatorName: null },
      { businessRating: 3, coordinatorRating: null, coordinatorId: null, coordinatorName: null },
      { businessRating: null, coordinatorRating: null, coordinatorId: null, coordinatorName: null },
    ];
    expect(businessAverage(reviews)).toBe(4);
  });

  it("is null with nothing answered", () => {
    expect(businessAverage([])).toBeNull();
  });
});

describe("coordinatorStandings", () => {
  it("groups by name, sorted best first", () => {
    const reviews = [
      { businessRating: null, coordinatorRating: 5, coordinatorId: "u1", coordinatorName: "Dana" },
      { businessRating: null, coordinatorRating: 3, coordinatorId: "u1", coordinatorName: "Dana" },
      { businessRating: null, coordinatorRating: 5, coordinatorId: "u2", coordinatorName: "Sam" },
    ];
    const out = coordinatorStandings(reviews);
    expect(out.map((c) => c.coordinatorName)).toEqual(["Sam", "Dana"]);
    expect(out[1].average).toBe(4);
    expect(out[1].count).toBe(2);
  });

  it("still rolls up under a name whose coordinator has since left (null id)", () => {
    const reviews = [
      { businessRating: null, coordinatorRating: 4, coordinatorId: null, coordinatorName: "Dana" },
    ];
    expect(coordinatorStandings(reviews)).toEqual([
      { coordinatorId: null, coordinatorName: "Dana", average: 4, count: 1 },
    ]);
  });

  it("skips reviews that never rated a coordinator", () => {
    const reviews = [
      { businessRating: 5, coordinatorRating: null, coordinatorId: null, coordinatorName: null },
    ];
    expect(coordinatorStandings(reviews)).toEqual([]);
  });
});
