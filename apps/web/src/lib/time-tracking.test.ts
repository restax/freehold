import { describe, expect, it } from "vitest";
import {
  effectiveHourlyCents,
  efficientClients,
  type FileTime,
  fmtMinutes,
  shouldCountPing,
  timeByClient,
  timeVsFee,
  utcDay,
} from "./time-tracking";

const file = (over: Partial<FileTime>): FileTime => ({
  transactionId: "t1",
  propertyAddress: "12 Main St",
  minutes: 0,
  expectedFeeCents: null,
  clientId: null,
  clientName: null,
  ...over,
});

describe("shouldCountPing", () => {
  it("accepts a ping 60s after the last one", () => {
    expect(
      shouldCountPing(new Date("2026-08-07T10:00:00Z"), new Date("2026-08-07T10:01:00Z")),
    ).toBe(true);
  });

  it("rejects a second tab pinging seconds later", () => {
    expect(
      shouldCountPing(new Date("2026-08-07T10:00:00Z"), new Date("2026-08-07T10:00:05Z")),
    ).toBe(false);
  });

  it("accepts at exactly the 50s dedupe boundary", () => {
    expect(
      shouldCountPing(new Date("2026-08-07T10:00:00Z"), new Date("2026-08-07T10:00:50Z")),
    ).toBe(true);
  });
});

describe("utcDay", () => {
  it("truncates to UTC midnight regardless of time of day", () => {
    expect(utcDay(new Date("2026-08-07T23:59:59Z")).toISOString()).toBe("2026-08-07T00:00:00.000Z");
  });
});

describe("fmtMinutes", () => {
  it("stays in minutes under an hour", () => {
    expect(fmtMinutes(45)).toBe("45m");
  });
  it("pads minutes past the hour", () => {
    expect(fmtMinutes(185)).toBe("3h 05m");
  });
  it("drops :00 on exact hours", () => {
    expect(fmtMinutes(120)).toBe("2h");
  });
});

describe("effectiveHourlyCents", () => {
  it("computes fee ÷ time as an hourly rate", () => {
    // $450 over 3 hours = $150/hr
    expect(effectiveHourlyCents(45_000, 180)).toBe(15_000);
  });
  it("returns null with no fee, a zero fee, or no time", () => {
    expect(effectiveHourlyCents(null, 60)).toBeNull();
    expect(effectiveHourlyCents(0, 60)).toBeNull();
    expect(effectiveHourlyCents(45_000, 0)).toBeNull();
  });
});

describe("timeVsFee", () => {
  it("ranks by minutes, drops untracked files, and attaches the hourly", () => {
    const rows = timeVsFee([
      file({ transactionId: "a", minutes: 30, expectedFeeCents: 40_000 }),
      file({ transactionId: "b", minutes: 90, expectedFeeCents: 45_000 }),
      file({ transactionId: "c", minutes: 0, expectedFeeCents: 45_000 }),
    ]);
    expect(rows.map((r) => r.transactionId)).toEqual(["b", "a"]);
    expect(rows[0].hourlyCents).toBe(30_000);
  });
});

describe("timeByClient / efficientClients", () => {
  const files = [
    file({ transactionId: "a", minutes: 200, clientId: "c1", clientName: "Alder Realty" }),
    file({ transactionId: "b", minutes: 100, clientId: "c1", clientName: "Alder Realty" }),
    file({ transactionId: "c", minutes: 60, clientId: "c2", clientName: "Birch Group" }),
    // No client and untracked rows never reach a client rollup.
    file({ transactionId: "d", minutes: 500 }),
    file({ transactionId: "e", minutes: 0, clientId: "c3", clientName: "Cedar & Co" }),
  ];

  it("sums time per client across files and ranks heaviest first", () => {
    const rows = timeByClient(files);
    expect(rows.map((r) => r.clientId)).toEqual(["c1", "c2"]);
    expect(rows[0].minutes).toBe(300);
    expect(rows[0].files).toBe(2);
  });

  it("ranks efficient clients by least average minutes per file", () => {
    const rows = efficientClients(files);
    expect(rows.map((r) => r.clientId)).toEqual(["c2", "c1"]);
    expect(rows[1].avgMinutesPerFile).toBe(150);
  });
});
