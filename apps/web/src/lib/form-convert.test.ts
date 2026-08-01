import { describe, expect, it } from "vitest";
import {
  clientDraftFrom,
  listingDraftFrom,
  parseClientType,
  parseDateOnly,
  parseSide,
  parseWholeNumber,
  partiesFrom,
  transactionDraftFrom,
  unmappedAnswers,
} from "./form-convert";
import { MAPPED_FIELDS } from "./form-schema";

describe("value parsers", () => {
  it("reads money with the noise people type", () => {
    expect(parseWholeNumber("$1,250,000")).toBe(1250000);
    expect(parseWholeNumber(" 610000 ")).toBe(610000);
    expect(parseWholeNumber("about four hundred")).toBeNull();
    expect(parseWholeNumber("")).toBeNull();
    expect(parseWholeNumber(undefined)).toBeNull();
  });

  it("reads dates as UTC midnight, matching the date columns", () => {
    expect(parseDateOnly("2026-09-30")?.toISOString()).toBe("2026-09-30T00:00:00.000Z");
    expect(parseDateOnly("30/09/2026")).toBeNull();
    expect(parseDateOnly("next tuesday")).toBeNull();
  });

  it("maps the side answers a form actually offers", () => {
    expect(parseSide("Buy side")).toBe("BUY_SIDE");
    expect(parseSide("Sell side")).toBe("SELL_SIDE");
    expect(parseSide("Dual (both sides)")).toBe("DUAL");
    expect(parseSide("dual")).toBe("DUAL");
    expect(parseSide("neither")).toBeNull();
  });

  it("maps client types", () => {
    expect(parseClientType("Individual agent")).toBe("AGENT");
    expect(parseClientType("Brokerage")).toBe("BROKERAGE");
    expect(parseClientType("Team")).toBe("TEAM");
    expect(parseClientType("something else")).toBeNull();
  });

  it("every choice a default form offers is one the converter understands", () => {
    // Guards the seam: if someone edits the options in MAPPED_FIELDS
    // without teaching the converter, this fails rather than silently
    // dropping the answer at conversion.
    const side = MAPPED_FIELDS.transaction_intake.find((f) => f.key === "side");
    for (const o of side?.options ?? []) expect(parseSide(o), o).not.toBeNull();
    const type = MAPPED_FIELDS.client_intake.find((f) => f.key === "clientType");
    for (const o of type?.options ?? []) expect(parseClientType(o), o).not.toBeNull();
  });
});

describe("transactionDraftFrom", () => {
  it("maps a filled-in submission onto the file's columns", () => {
    expect(
      transactionDraftFrom({
        propertyAddress: "88 Larkspur Way",
        city: "Sausalito",
        state: "ca",
        zip: "94965",
        side: "Sell side",
        purchasePrice: "$1,620,000",
        closeDate: "2026-09-30",
        notes: "Relocating.",
      }),
    ).toEqual({
      propertyAddress: "88 Larkspur Way",
      city: "Sausalito",
      state: "CA",
      zip: "94965",
      side: "SELL_SIDE",
      purchasePrice: 1620000,
      listPrice: null,
      contractDate: null,
      closeDate: new Date("2026-09-30T00:00:00.000Z"),
      listDate: null,
      expireDate: null,
      mlsId: null,
      notes: "Relocating.",
    });
  });

  it("refuses to make a file with no address", () => {
    expect(transactionDraftFrom({ city: "Sausalito" })).toBeNull();
    expect(transactionDraftFrom({ propertyAddress: "   " })).toBeNull();
  });

  it("falls back to buy side rather than inventing a side", () => {
    expect(transactionDraftFrom({ propertyAddress: "1 A St" })?.side).toBe("BUY_SIDE");
  });

  it("carries the listing columns a listing form fills in", () => {
    const d = transactionDraftFrom({
      propertyAddress: "1 A St",
      listPrice: "$799,000",
      listDate: "2026-08-15",
      expireDate: "2026-11-15",
    });
    expect(d?.listPrice).toBe(799000);
    expect(d?.listDate?.toISOString()).toBe("2026-08-15T00:00:00.000Z");
    expect(d?.expireDate?.toISOString()).toBe("2026-11-15T00:00:00.000Z");
  });
});

describe("listingDraftFrom", () => {
  it("assumes sell side, because that is what taking a listing means", () => {
    expect(listingDraftFrom({ propertyAddress: "1 A St" })?.side).toBe("SELL_SIDE");
  });

  it("still lets the form say otherwise", () => {
    expect(listingDraftFrom({ propertyAddress: "1 A St", side: "Dual (both sides)" })?.side).toBe(
      "DUAL",
    );
  });

  it("refuses an addressless listing the same as any other file", () => {
    expect(listingDraftFrom({ listPrice: "100" })).toBeNull();
  });
});

describe("clientDraftFrom", () => {
  it("keeps a brokerage reference for an individual agent", () => {
    const d = clientDraftFrom({
      clientName: "Priya Raman",
      clientType: "Individual agent",
      email: "priya@example.com",
      brokerageName: "Harborline Realty",
      brokeragePhone: "555-0100",
      // An office's billing contact makes no sense here and is dropped.
      billingName: "Dana",
    });
    expect(d).toMatchObject({
      name: "Priya Raman",
      type: "AGENT",
      brokerageInfo: { name: "Harborline Realty", phone: "555-0100" },
      billingContact: null,
    });
  });

  it("keeps a billing contact for an office, and drops the brokerage field", () => {
    const d = clientDraftFrom({
      clientName: "Harborline Realty",
      clientType: "Brokerage",
      billingName: "Dana Whitfield",
      billingEmail: "ap@harborline.example",
      brokerageName: "should not survive",
    });
    expect(d).toMatchObject({
      type: "BROKERAGE",
      billingContact: { name: "Dana Whitfield", email: "ap@harborline.example" },
      brokerageInfo: null,
    });
  });

  it("defaults to an agent when the type wasn't asked", () => {
    expect(clientDraftFrom({ clientName: "Someone" })?.type).toBe("AGENT");
  });

  it("refuses to make a client with no name", () => {
    expect(clientDraftFrom({ email: "a@b.example" })).toBeNull();
  });
});

describe("partiesFrom", () => {
  it("turns mapped party cells into roles on the file", () => {
    expect(
      partiesFrom({
        buyerAgent: { name: "Casey Rivera", email: "casey@x.example" },
        attorney: { name: "R. Vance" },
        titleCompany: { name: "Lakeview Title", phone: "555-0111" },
      }),
    ).toEqual([
      { role: "BUYER_AGENT", name: "Casey Rivera", email: "casey@x.example" },
      { role: "ATTORNEY", name: "R. Vance" },
      { role: "TITLE_COMPANY", name: "Lakeview Title", phone: "555-0111" },
    ]);
  });

  it("skips a party with contact details but no name", () => {
    // A contact row with an email and no name is noise in the CRM.
    expect(partiesFrom({ attorney: { email: "someone@x.example" } })).toEqual([]);
    expect(partiesFrom({})).toEqual([]);
  });
});

describe("unmappedAnswers", () => {
  const mapped = MAPPED_FIELDS.transaction_intake.map((f) => f.key);

  it("keeps the TC's own questions so they don't vanish at conversion", () => {
    expect(
      unmappedAnswers(
        {
          propertyAddress: "88 Larkspur Way",
          hasSurvey: true,
          gateCode: "4417",
          referredBy: { name: "Dana", phone: "555-0100" },
        },
        mapped,
      ),
    ).toEqual([
      { key: "hasSurvey", value: "Yes" },
      { key: "gateCode", value: "4417" },
      { key: "referredBy", value: "Dana · 555-0100" },
    ]);
  });

  it("says nothing about answers that already found a column", () => {
    expect(
      unmappedAnswers({ propertyAddress: "88 Larkspur Way", side: "Buy side" }, mapped),
    ).toEqual([]);
  });
});
