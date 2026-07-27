import { describe, expect, it } from "vitest";
import {
  assigneePayout,
  filePayoutTotals,
  formatPercentBp,
  parsePercentToBp,
  payoutCents,
} from "./billing-payouts";

const flat = (cents: number) => ({ feeCents: cents, feePercentBp: null });
const pct = (bp: number) => ({ feeCents: null, feePercentBp: bp });

describe("payoutCents", () => {
  it("flat ignores revenue; percent scales with it", () => {
    expect(payoutCents(flat(35000), 0)).toBe(35000);
    expect(payoutCents(pct(7000), 40000)).toBe(28000);
    expect(payoutCents(pct(7000), 0)).toBe(0);
  });

  it("no basis means no payout", () => {
    expect(payoutCents({ feeCents: null, feePercentBp: null }, 40000)).toBe(0);
  });

  it("fractional percents round to the cent", () => {
    expect(payoutCents(pct(725), 10000)).toBe(725); // 7.25% of $100
  });
});

describe("assigneePayout / filePayoutTotals", () => {
  it("earned reads billed, payable reads collected", () => {
    const p = assigneePayout(pct(7000), 40000, 10000);
    expect(p).toEqual({ earnedCents: 28000, payableCents: 7000 });
  });

  it("flat is earned and payable in full regardless of collection", () => {
    const p = assigneePayout(flat(20000), 40000, 0);
    expect(p).toEqual({ earnedCents: 20000, payableCents: 20000 });
  });

  it("file totals net both ways", () => {
    // $400 billed, $100 collected; one 70% partner + one $50 flat.
    const t = filePayoutTotals([pct(7000), flat(5000)], 40000, 10000);
    expect(t.earnedCents).toBe(33000);
    expect(t.payableCents).toBe(12000);
    expect(t.netBilledCents).toBe(7000);
    expect(t.netCollectedCents).toBe(-2000); // flat owed before money's in
  });
});

describe("percent formatting", () => {
  it("round-trips clean and fractional percents", () => {
    expect(formatPercentBp(7000)).toBe("70%");
    expect(formatPercentBp(725)).toBe("7.25%");
    expect(parsePercentToBp("70")).toBe(7000);
    expect(parsePercentToBp("7.25%")).toBe(725);
  });

  it("rejects junk and out-of-range values", () => {
    expect(parsePercentToBp("")).toBeNull();
    expect(parsePercentToBp("abc")).toBeNull();
    expect(parsePercentToBp("101")).toBeNull();
  });
});
