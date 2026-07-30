import { describe, expect, it } from "vitest";
import {
  bucketByDay,
  bucketSize,
  type ChartRange,
  parseRange,
  peak,
  topClients,
} from "./dashboard-charts";

const NOW = new Date("2026-07-30T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000);

describe("parseRange", () => {
  it("accepts the offered windows", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("30")).toBe(30);
    expect(parseRange("90")).toBe(90);
  });

  it("falls back to 30 for anything else", () => {
    // The value comes off the URL, so it is whatever someone typed.
    for (const bad of ["", undefined, "abc", "0", "-7", "365", "7; drop table"]) {
      expect(parseRange(bad), String(bad)).toBe(30);
    }
  });
});

describe("bucketSize", () => {
  it("keeps the bar count readable as the window grows", () => {
    // A 90-day chart at one bar a day is a smear; weekly bars stay legible.
    expect(bucketSize(7)).toBe(1);
    expect(bucketSize(30)).toBe(3);
    expect(bucketSize(90)).toBe(7);
  });
});

describe("bucketByDay", () => {
  it("returns one bar per day over a week, oldest first", () => {
    const b = bucketByDay([], 7, NOW);
    expect(b).toHaveLength(7);
    expect(b[6].label).toBe("Jul 30");
    expect(b[0].label).toBe("Jul 24");
  });

  it("counts today into the last bucket", () => {
    const b = bucketByDay([daysAgo(0)], 7, NOW);
    expect(b[6].count).toBe(1);
    expect(b.slice(0, 6).every((x) => x.count === 0)).toBe(true);
  });

  it("puts yesterday in the previous bucket, not today's", () => {
    const b = bucketByDay([daysAgo(1)], 7, NOW);
    expect(b[6].count).toBe(0);
    expect(b[5].count).toBe(1);
  });

  it("keeps empty periods as empty bars rather than dropping them", () => {
    // The gap is the information — a quiet fortnight should look quiet, not
    // get compressed out of the axis.
    const b = bucketByDay([daysAgo(0), daysAgo(6)], 7, NOW);
    expect(b.map((x) => x.count)).toEqual([1, 0, 0, 0, 0, 0, 1]);
  });

  it("ignores anything outside the window", () => {
    const b = bucketByDay([daysAgo(100), daysAgo(8)], 7, NOW);
    expect(b.reduce((s, x) => s + x.count, 0)).toBe(0);
  });

  it("ignores dates in the future", () => {
    const tomorrow = new Date(NOW.getTime() + 24 * 3600 * 1000);
    const b = bucketByDay([tomorrow], 7, NOW);
    expect(b.reduce((s, x) => s + x.count, 0)).toBe(0);
  });

  it("groups a 90-day window into weekly bars covering everything", () => {
    const every = Array.from({ length: 90 }, (_, i) => daysAgo(i));
    const b = bucketByDay(every, 90, NOW);
    expect(b.length).toBeLessThanOrEqual(14);
    // Every day in range lands somewhere: nothing is silently dropped between
    // buckets, which is the classic off-by-one in this kind of code.
    expect(b.reduce((s, x) => s + x.count, 0)).toBe(90);
  });

  it("counts a whole 30-day window without loss", () => {
    const every = Array.from({ length: 30 }, (_, i) => daysAgo(i));
    expect(bucketByDay(every, 30, NOW).reduce((s, x) => s + x.count, 0)).toBe(30);
  });

  it("is unaffected by the time of day on a timestamp", () => {
    // A file opened at 11pm belongs to that day, not the next one.
    const lateToday = new Date("2026-07-30T23:59:00.000Z");
    const b = bucketByDay([lateToday], 7, NOW);
    expect(b[6].count).toBe(1);
  });

  it("handles every offered range without throwing", () => {
    for (const r of [7, 30, 90] as ChartRange[]) {
      expect(bucketByDay([daysAgo(1)], r, NOW).length).toBeGreaterThan(0);
    }
  });
});

describe("topClients", () => {
  const files = [
    { clientId: "a", clientName: "Sunrise Realty" },
    { clientId: "a", clientName: "Sunrise Realty" },
    { clientId: "b", clientName: "Golden Gate" },
    { clientId: null, clientName: null },
  ];

  it("ranks by how much work each client sent", () => {
    expect(topClients(files).map((c) => [c.name, c.count])).toEqual([
      ["Sunrise Realty", 2],
      ["Golden Gate", 1],
    ]);
  });

  it("leaves out files with no client", () => {
    expect(topClients(files).reduce((s, c) => s + c.count, 0)).toBe(3);
  });

  it("breaks ties by name so the order doesn't wander between loads", () => {
    const tied = [
      { clientId: "z", clientName: "Zenith" },
      { clientId: "a", clientName: "Acme" },
    ];
    expect(topClients(tied).map((c) => c.name)).toEqual(["Acme", "Zenith"]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      clientId: `c${i}`,
      clientName: `Client ${i}`,
    }));
    expect(topClients(many)).toHaveLength(5);
    expect(topClients(many, 3)).toHaveLength(3);
  });

  it("copes with a client whose name is missing", () => {
    expect(topClients([{ clientId: "x", clientName: null }])[0].name).toBe("Unnamed client");
  });
});

describe("peak", () => {
  it("returns the tallest value", () => {
    expect(peak([1, 5, 3])).toBe(5);
  });

  it("never returns zero, so an empty chart doesn't divide by nothing", () => {
    expect(peak([])).toBe(1);
    expect(peak([0, 0])).toBe(1);
  });
});
