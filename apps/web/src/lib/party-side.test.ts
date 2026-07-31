import { describe, expect, it } from "vitest";
import { groupPartiesBySide, partyGroup } from "./party-side";

const parties = [
  { id: "1", role: "SELLER" },
  { id: "2", role: "TITLE_COMPANY" },
  { id: "3", role: "BUYER" },
  { id: "4", role: "BUYER_AGENT" },
  { id: "5", role: "LISTING_AGENT" },
];

describe("partyGroup", () => {
  it("puts the buyer and their agent on our side of a buy-side file", () => {
    expect(partyGroup("BUYER", "BUY_SIDE")).toBe("ours");
    expect(partyGroup("BUYER_AGENT", "BUY_SIDE")).toBe("ours");
    expect(partyGroup("SELLER", "BUY_SIDE")).toBe("theirs");
    expect(partyGroup("LISTING_AGENT", "BUY_SIDE")).toBe("theirs");
  });

  it("flips for a sell-side file", () => {
    expect(partyGroup("SELLER", "SELL_SIDE")).toBe("ours");
    expect(partyGroup("BUYER", "SELL_SIDE")).toBe("theirs");
  });

  it("treats third parties as belonging to neither side", () => {
    for (const role of ["TITLE_COMPANY", "LENDER", "INSPECTOR", "APPRAISER", "ATTORNEY", "OTHER"]) {
      expect(partyGroup(role, "BUY_SIDE")).toBe("shared");
      expect(partyGroup(role, "SELL_SIDE")).toBe("shared");
    }
  });
});

describe("groupPartiesBySide", () => {
  it("orders ours, then shared, then theirs", () => {
    const rows = groupPartiesBySide(parties, "BUY_SIDE");
    expect(rows.map((r) => r.party.id)).toEqual(["3", "4", "2", "1", "5"]);
    expect(rows.map((r) => r.group)).toEqual(["ours", "ours", "shared", "theirs", "theirs"]);
  });

  it("marks only the first row of each run so headings render once", () => {
    const rows = groupPartiesBySide(parties, "BUY_SIDE");
    expect(rows.map((r) => r.firstOfGroup)).toEqual([true, false, true, true, false]);
  });

  it("keeps the original order and shows no headings on a dual file", () => {
    const rows = groupPartiesBySide(parties, "DUAL");
    expect(rows.map((r) => r.party.id)).toEqual(["1", "2", "3", "4", "5"]);
    expect(rows.every((r) => !r.firstOfGroup)).toBe(true);
  });
});
