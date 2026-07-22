import { describe, expect, it } from "vitest";
import { FREE_STARTING_CREDITS, PLAN_INFO, proAllowed } from "./plans";

describe("Free plan limits (AI-credits spec)", () => {
  it("Free is one seat, two active transactions, fifteen portal clients", () => {
    expect(PLAN_INFO.FREE.includedSeats).toBe(1);
    expect(PLAN_INFO.FREE.activeTransactionLimit).toBe(2);
    expect(PLAN_INFO.FREE.portalClientLimit).toBe(15);
  });

  it("a new Free workspace starts with two credits", () => {
    expect(FREE_STARTING_CREDITS).toBe(2);
  });
});

describe("proAllowed — per-transaction pro-AI gate", () => {
  it("self-host is always pro, regardless of tier or flag", () => {
    expect(proAllowed("FREE", false, false)).toBe(true);
    expect(proAllowed("FREE", true, false)).toBe(true);
    expect(proAllowed("PRO", false, false)).toBe(true);
  });

  it("Cloud paid/comped tiers are always pro", () => {
    expect(proAllowed("PRO", false, true)).toBe(true);
    expect(proAllowed("BUSINESS", false, true)).toBe(true);
  });

  it("Cloud Free is pro only once a credit was spent on the transaction", () => {
    expect(proAllowed("FREE", false, true)).toBe(false);
    expect(proAllowed("FREE", true, true)).toBe(true);
  });
});
