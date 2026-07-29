import { describe, expect, it } from "vitest";
import { deriveSide, namesMatch, nameTokens } from "./side-derive";

describe("nameTokens", () => {
  it("ignores case, punctuation and ordering", () => {
    expect(nameTokens("Raman, Priya")).toEqual(nameTokens("priya raman"));
    expect(nameTokens("PRIYA  RAMAN")).toEqual(nameTokens("Priya Raman"));
  });

  it("drops the honorifics contracts sprinkle in", () => {
    expect(nameTokens("Priya Raman, Esq.")).toEqual(nameTokens("Priya Raman"));
    expect(nameTokens("Dana Cole Jr")).toEqual(nameTokens("Dana Cole"));
  });

  it("drops single letters, so a middle initial doesn't block a match", () => {
    expect(nameTokens("Priya M Raman")).toEqual(nameTokens("Priya Raman"));
  });
});

describe("namesMatch", () => {
  it("matches the same person written differently", () => {
    expect(namesMatch("Priya Raman", "Raman, Priya")).toBe(true);
    expect(namesMatch("Priya Raman", "PRIYA RAMAN, ESQ.")).toBe(true);
    expect(namesMatch("Priya Raman", "Priya M. Raman")).toBe(true);
  });

  it("matches a name inside a longer business name", () => {
    expect(namesMatch("Priya Raman", "Priya Raman Realty Group")).toBe(true);
  });

  it("refuses different people who share a surname", () => {
    expect(namesMatch("Priya Raman", "Dana Raman")).toBe(false);
    expect(namesMatch("Priya Raman", "Priya Chen")).toBe(false);
  });

  it("refuses a single shared token — half a brokerage is called Smith", () => {
    expect(namesMatch("Smith", "John Smith")).toBe(false);
  });

  it("is safe on empty and punctuation-only input", () => {
    expect(namesMatch("", "Priya Raman")).toBe(false);
    expect(namesMatch("   ", "Priya Raman")).toBe(false);
    expect(namesMatch("-- , .", "Priya Raman")).toBe(false);
  });
});

describe("deriveSide", () => {
  const base = { buyerAgent: "Priya Raman", listingAgent: "Dana Cole" };

  it("reads buy side when our client is the buyer's agent", () => {
    expect(deriveSide({ ...base, clientNames: ["Priya Raman"] })).toEqual({
      side: "BUY_SIDE",
      confidence: "HIGH",
      matchedOn: "Priya Raman",
    });
  });

  it("reads sell side when our client is the listing agent", () => {
    expect(deriveSide({ ...base, clientNames: ["Dana Cole"] })?.side).toBe("SELL_SIDE");
  });

  it("reads dual when our client is named on both sides", () => {
    const r = deriveSide({
      buyerAgent: "Dana Cole",
      listingAgent: "Dana Cole",
      clientNames: ["Dana Cole"],
    });
    expect(r?.side).toBe("DUAL");
    expect(r?.confidence).toBe("HIGH");
  });

  it("matches an agent on the client's roster, not just the client's own name", () => {
    // A brokerage client whose agent signed the contract.
    const r = deriveSide({ ...base, clientNames: ["Harborline Realty", "Dana Cole"] });
    expect(r?.side).toBe("SELL_SIDE");
    expect(r?.matchedOn).toBe("Dana Cole");
  });

  it("returns null when neither agent is ours — ask rather than guess", () => {
    // The expensive failure: filing a listing as a buy-side deal.
    expect(deriveSide({ ...base, clientNames: ["Someone Else"] })).toBeNull();
  });

  it("returns null with no client chosen", () => {
    expect(deriveSide({ ...base, clientNames: [] })).toBeNull();
    expect(deriveSide({ ...base, clientNames: ["", "  "] })).toBeNull();
  });

  it("copes with the extractor finding only one agent", () => {
    expect(
      deriveSide({ buyerAgent: "Priya Raman", listingAgent: null, clientNames: ["Priya Raman"] })
        ?.side,
    ).toBe("BUY_SIDE");
    expect(
      deriveSide({ buyerAgent: null, listingAgent: "", clientNames: ["Priya Raman"] }),
    ).toBeNull();
  });
});
