import { describe, expect, it } from "vitest";
import {
  type ContractExtractionResult,
  executionNotice,
  flattenExtraction,
  matchPartyRole,
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
  execution: null,
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

describe("matchPartyRole", () => {
  const ROLES = [
    "BUYER",
    "SELLER",
    "BUYER_AGENT",
    "LISTING_AGENT",
    "LENDER",
    "TITLE_COMPANY",
    "INSPECTOR",
    "APPRAISER",
    "ATTORNEY",
    "OTHER",
  ] as const;

  it("uppercases every extraction role that has a real match", () => {
    // These are the exact keys flattenExtraction produces from party:<role>.
    for (const [extracted, expected] of [
      ["buyer", "BUYER"],
      ["seller", "SELLER"],
      ["buyer_agent", "BUYER_AGENT"],
      ["listing_agent", "LISTING_AGENT"],
      ["lender", "LENDER"],
      ["title_company", "TITLE_COMPANY"],
      ["attorney", "ATTORNEY"],
      ["other", "OTHER"],
    ] as const) {
      expect(matchPartyRole(extracted, ROLES, "OTHER")).toBe(expected);
    }
  });

  it("falls back rather than storing a role the enum doesn't have", () => {
    // Extraction output isn't guaranteed against the Prisma enum; a made-up
    // or future role must degrade instead of failing the whole link.
    expect(matchPartyRole("escrow_officer", ROLES, "OTHER")).toBe("OTHER");
    expect(matchPartyRole("", ROLES, "OTHER")).toBe("OTHER");
  });

  it("is already-uppercase safe", () => {
    expect(matchPartyRole("BUYER_AGENT", ROLES, "OTHER")).toBe("BUYER_AGENT");
  });

  it("uses the caller's own fallback, not a hardcoded one", () => {
    expect(matchPartyRole("nonsense", ROLES, "BUYER")).toBe("BUYER");
  });
});

describe("executionNotice", () => {
  const base = {
    signed_by: [] as string[],
    missing_signatures: [] as string[],
    page: 12,
    quote: "signature block",
    confidence: "high" as const,
  };

  it("treats an unsigned draft as the loudest case", () => {
    // The whole point: a coordinator building deadlines off a draft has a
    // file full of dates nobody is bound to, and nothing else on the screen
    // says so.
    const n = executionNotice({ ...base, status: "unsigned" });
    expect(n.tone).toBe("danger");
    expect(n.headline).toMatch(/draft/i);
    expect(n.action).toMatch(/executed copy/i);
  });

  it("flags a partly-signed contract and names who still has to sign", () => {
    const n = executionNotice({
      ...base,
      status: "partially_signed",
      signed_by: ["Charles M. Caputo (Seller)"],
      missing_signatures: ["Can Chen (Buyer)", "Annie Chen (Buyer)"],
    });
    expect(n.tone).toBe("danger");
    expect(n.headline).toContain("2");
    expect(n.missing).toEqual(["Can Chen (Buyer)", "Annie Chen (Buyer)"]);
  });

  it("uses the singular when exactly one signature is outstanding", () => {
    const n = executionNotice({
      ...base,
      status: "partially_signed",
      missing_signatures: ["Can Chen (Buyer)"],
    });
    expect(n.headline).toMatch(/one signature/i);
  });

  it("asks for a complete copy when the signature pages are missing", () => {
    const n = executionNotice({ ...base, status: "unclear" });
    expect(n.tone).toBe("warning");
    expect(n.action).toMatch(/complete copy/i);
  });

  it("says nothing alarming about a fully executed contract", () => {
    const n = executionNotice({ ...base, status: "executed", signed_by: ["A", "B"] });
    expect(n.tone).toBe("success");
    expect(n.action).toBe("");
    expect(n.missing).toEqual([]);
  });

  it("treats a missing check as unverified rather than fine", () => {
    // An older extraction, or a model that omitted the field, must not read
    // as "signed" — absence of evidence isn't evidence of a signature.
    const n = executionNotice(null);
    expect(n.tone).not.toBe("success");
    expect(n.headline).toMatch(/can't tell/i);
  });

  it("ignores blank entries in the missing list", () => {
    const n = executionNotice({
      ...base,
      status: "partially_signed",
      missing_signatures: ["Can Chen (Buyer)", "  ", ""],
    });
    expect(n.missing).toEqual(["Can Chen (Buyer)"]);
  });
});
