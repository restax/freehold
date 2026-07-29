import { describe, expect, it } from "vitest";
import { commissionLabel, grossFromPct, parseCommissionPct, parseGrossCents } from "./commission";

describe("commissionLabel", () => {
  it("names the client when the client is the agent", () => {
    expect(commissionLabel("AGENT")).toBe("Client's commission %");
  });

  it("names the agent when the client is an office", () => {
    // The office is the client; the money belongs to one of their agents.
    expect(commissionLabel("BROKERAGE")).toBe("Agent's commission %");
    expect(commissionLabel("TEAM")).toBe("Agent's commission %");
  });

  it("stays neutral when whose money it is isn't known", () => {
    for (const t of ["TITLE", "LENDER", "OTHER", null, undefined, "", "NONSENSE"]) {
      expect(commissionLabel(t)).toBe("Commission %");
    }
  });
});

describe("parseCommissionPct", () => {
  it("takes what a coordinator actually types", () => {
    expect(parseCommissionPct("3")).toBe(3);
    expect(parseCommissionPct("3%")).toBe(3);
    expect(parseCommissionPct(" 2.75 ")).toBe(2.75);
    expect(parseCommissionPct("0")).toBe(0);
  });

  it("reads blank as unset, not zero", () => {
    // Zero means "no commission"; blank means nobody has said yet.
    expect(parseCommissionPct("")).toBeNull();
    expect(parseCommissionPct("   ")).toBeNull();
  });

  it("rejects a percentage over 100 — that's 30 typed for 3.0", () => {
    expect(parseCommissionPct("300")).toBeNull();
    expect(parseCommissionPct("100.1")).toBeNull();
    expect(parseCommissionPct("100")).toBe(100);
  });

  it("rejects junk and negatives rather than storing them", () => {
    for (const v of ["abc", "-3", "3.3.3", "N/A"]) {
      expect(parseCommissionPct(v)).toBeNull();
    }
  });
});

describe("parseGrossCents", () => {
  it("takes dollars with symbols and separators", () => {
    expect(parseGrossCents("$12,500.50")).toBe(1250050);
    expect(parseGrossCents("12500")).toBe(1250000);
    expect(parseGrossCents("0")).toBe(0);
  });

  it("rounds to whole cents rather than storing a fraction", () => {
    expect(parseGrossCents("10.005")).toBe(1001);
    expect(parseGrossCents("10.004")).toBe(1000);
  });

  it("reads blank as unset and refuses junk", () => {
    expect(parseGrossCents("")).toBeNull();
    expect(parseGrossCents("abc")).toBeNull();
    expect(parseGrossCents("-5")).toBeNull();
  });
});

describe("grossFromPct", () => {
  it("gives the cents a percentage is worth against a price", () => {
    // 3% of $400,000 = $12,000 = 1,200,000 cents.
    expect(grossFromPct(3, 400000)).toBe(1200000);
    expect(grossFromPct(2.5, 400000)).toBe(1000000);
  });

  it("declines to guess without both numbers", () => {
    expect(grossFromPct(null, 400000)).toBeNull();
    expect(grossFromPct(3, null)).toBeNull();
    expect(grossFromPct(3, 0)).toBeNull();
  });
});
