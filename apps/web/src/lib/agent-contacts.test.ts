import { describe, expect, it } from "vitest";
import { isAgentEligible } from "./agent-contacts";

describe("isAgentEligible", () => {
  it("includes a contact never linked to any transaction", () => {
    expect(isAgentEligible([])).toBe(true);
  });

  it("includes a contact who has been a buyer's or listing agent", () => {
    expect(isAgentEligible([{ role: "BUYER_AGENT" }])).toBe(true);
    expect(isAgentEligible([{ role: "LISTING_AGENT" }])).toBe(true);
  });

  it("excludes a contact only ever added as a buyer, seller, or third party", () => {
    expect(isAgentEligible([{ role: "BUYER" }])).toBe(false);
    expect(isAgentEligible([{ role: "SELLER" }])).toBe(false);
    expect(isAgentEligible([{ role: "ATTORNEY" }])).toBe(false);
    expect(isAgentEligible([{ role: "TITLE_COMPANY" }])).toBe(false);
    expect(isAgentEligible([{ role: "OTHER" }])).toBe(false);
  });

  it("includes a contact who is both a buyer on one file and an agent on another", () => {
    expect(isAgentEligible([{ role: "BUYER" }, { role: "LISTING_AGENT" }])).toBe(true);
  });
});
