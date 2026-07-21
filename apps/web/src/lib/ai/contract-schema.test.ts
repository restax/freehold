import { describe, expect, it } from "vitest";
import {
  type ContractExtractionResult,
  flattenExtraction,
  parseDateValue,
  parseMoneyValue,
  transactionUpdateFor,
} from "./contract-schema";

const cited = (value: string, page = 1, confidence: "high" | "medium" | "low" = "high") => ({
  value,
  page,
  quote: `...${value}...`,
  confidence,
});

const RESULT: ContractExtractionResult = {
  property_address: cited("412 Maple Avenue"),
  city: cited("Springfield"),
  state: cited("IL"),
  zip: null,
  purchase_price: cited("385,000.00", 1, "high"),
  contract_date: cited("2026-07-15"),
  close_date: cited("2026-08-14", 2),
  deadlines: [
    {
      label: "Inspection deadline",
      date: "2026-07-25",
      page: 3,
      quote: "within ten (10) days of the Effective Date",
      confidence: "medium",
    },
  ],
  parties: [
    {
      role: "buyer",
      name: "Jordan Bell",
      page: 1,
      quote: "Jordan Bell (Buyer)",
      confidence: "high",
    },
  ],
};

describe("flattenExtraction", () => {
  it("keeps only grounded fields, in order, with targets", () => {
    const rows = flattenExtraction(RESULT);
    expect(rows.map((r) => r.key)).toEqual([
      "property_address",
      "city",
      "state",
      "purchase_price",
      "contract_date",
      "close_date",
      "deadline:Inspection deadline",
      "party:buyer",
    ]);
    expect(rows.find((r) => r.key === "zip")).toBeUndefined();
    expect(rows.find((r) => r.key === "deadline:Inspection deadline")?.target).toBe("TASK");
    expect(rows.find((r) => r.key === "party:buyer")?.target).toBe("PARTY");
    expect(rows.find((r) => r.key === "purchase_price")?.confidence).toBe("HIGH");
  });
});

describe("value parsing", () => {
  it("parses dates strictly", () => {
    expect(parseDateValue("2026-08-14")?.toISOString()).toBe("2026-08-14T00:00:00.000Z");
    expect(parseDateValue("08/14/2026")).toBeNull();
    expect(parseDateValue("unknown")).toBeNull();
  });

  it("parses money in common formats", () => {
    expect(parseMoneyValue("385000")).toBe(385000);
    expect(parseMoneyValue("$385,000.00")).toBe(385000);
    expect(parseMoneyValue("TBD")).toBeNull();
  });
});

describe("transactionUpdateFor", () => {
  it("maps scalar keys to prisma fragments", () => {
    expect(transactionUpdateFor("property_address", "412 Maple Avenue")).toEqual({
      propertyAddress: "412 Maple Avenue",
    });
    expect(transactionUpdateFor("purchase_price", "$385,000")).toEqual({ purchasePrice: 385000 });
    expect(transactionUpdateFor("close_date", "2026-08-14")).toEqual({
      closeDate: new Date("2026-08-14T00:00:00.000Z"),
    });
  });

  it("returns null for unparseable or unknown values", () => {
    expect(transactionUpdateFor("purchase_price", "to be determined")).toBeNull();
    expect(transactionUpdateFor("contract_date", "next Tuesday")).toBeNull();
    expect(transactionUpdateFor("unknown_key", "x")).toBeNull();
  });
});
