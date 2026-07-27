import { describe, expect, it } from "vitest";
import { agingReport, csvField, monthlyCollected, toCsv } from "./billing-reports";

describe("agingReport", () => {
  it("buckets balances by days past due, boundaries inclusive", () => {
    const out = agingReport([
      { balanceCents: 100, daysPastDue: 0 },
      { balanceCents: 200, daysPastDue: 1 },
      { balanceCents: 300, daysPastDue: 30 },
      { balanceCents: 400, daysPastDue: 31 },
      { balanceCents: 500, daysPastDue: 90 },
      { balanceCents: 600, daysPastDue: 91 },
    ]);
    expect(out).toEqual({ Current: 100, "1–30": 500, "31–60": 400, "61–90": 500, "90+": 600 });
  });

  it("ignores settled and overpaid rows", () => {
    const out = agingReport([
      { balanceCents: 0, daysPastDue: 45 },
      { balanceCents: -500, daysPastDue: 45 },
    ]);
    expect(out["31–60"]).toBe(0);
  });
});

describe("monthlyCollected", () => {
  const now = new Date(2026, 6, 27); // July 2026

  it("covers the window newest first, empty months included", () => {
    const out = monthlyCollected(
      [
        { amountCents: 35000, receivedAt: new Date(2026, 6, 5) },
        { amountCents: 10000, receivedAt: new Date(2026, 4, 20) },
        { amountCents: 99999, receivedAt: new Date(2025, 6, 1) }, // outside window
      ],
      3,
      now,
    );
    expect(out).toEqual([
      { month: "2026-07", cents: 35000 },
      { month: "2026-06", cents: 0 },
      { month: "2026-05", cents: 10000 },
    ]);
  });

  it("nets reversals out of the month they landed in", () => {
    const out = monthlyCollected(
      [
        { amountCents: 35000, receivedAt: new Date(2026, 6, 5) },
        { amountCents: -35000, receivedAt: new Date(2026, 6, 9) },
      ],
      1,
      now,
    );
    expect(out[0].cents).toBe(0);
  });
});

describe("csv", () => {
  it("escapes quotes, commas, and newlines per RFC 4180", () => {
    expect(csvField('a "b", c')).toBe('"a ""b"", c"');
    expect(csvField("plain")).toBe("plain");
    expect(csvField(null)).toBe("");
  });

  it("assembles header + rows with CRLF", () => {
    expect(toCsv(["a", "b"], [["1", "x,y"]])).toBe('a,b\r\n1,"x,y"');
  });
});
