import { describe, expect, it } from "vitest";
import { buildMergeContext, renderTemplatePdf, resolveTemplate } from "./templates";

const TXN = {
  propertyAddress: "412 Maple Avenue",
  city: "Springfield",
  state: "IL",
  zip: "62704",
  purchasePrice: 385000,
  contractDate: new Date("2026-07-15T00:00:00.000Z"),
  closeDate: new Date("2026-08-14T00:00:00.000Z"),
  status: "UNDER_CONTRACT",
  side: "BUY_SIDE",
  notes: null,
  customFields: { "MLS #": "MLS-102938" },
  client: { name: "Sunrise Realty Group", email: "team@sunrise.example", phone: null },
  parties: [
    { role: "BUYER", contact: { name: "Jordan Bell", email: "jordan@example.com", phone: null } },
  ],
};

describe("buildMergeContext", () => {
  it("formats dates, money, parties, and custom fields", () => {
    const ctx = buildMergeContext(TXN, "Acme Realty Group", new Date("2026-07-18T12:00:00Z"));
    expect(ctx["transaction.closeDate"]).toBe("2026-08-14");
    expect(ctx["transaction.purchasePrice"]).toBe("$385,000");
    expect(ctx["party.BUYER.name"]).toBe("Jordan Bell");
    expect(ctx["custom.MLS #"]).toBe("MLS-102938");
    expect(ctx["tenant.name"]).toBe("Acme Realty Group");
    expect(ctx.today).toBe("2026-07-18");
  });

  it("suffixes a second party in the same role instead of overwriting the first", () => {
    const ctx = buildMergeContext(
      {
        ...TXN,
        parties: [
          {
            role: "SELLER",
            contact: { name: "Alex Rivera", email: "alex@example.com", phone: null },
          },
          {
            role: "SELLER",
            contact: { name: "Sam Rivera", email: "sam@example.com", phone: null },
          },
          {
            role: "SELLER",
            contact: { name: "Jamie Rivera", email: "jamie@example.com", phone: null },
          },
        ],
      },
      "Acme Realty Group",
    );
    expect(ctx["party.SELLER.name"]).toBe("Alex Rivera");
    expect(ctx["party.SELLER_2.name"]).toBe("Sam Rivera");
    expect(ctx["party.SELLER_2.email"]).toBe("sam@example.com");
    expect(ctx["party.SELLER_3.name"]).toBe("Jamie Rivera");
  });
});

describe("resolveTemplate", () => {
  it("replaces known tokens and reports unknown ones", () => {
    const ctx = buildMergeContext(TXN, "Acme Realty Group");
    const { text, unknownKeys } = resolveTemplate(
      "Dear {{party.BUYER.name}}, closing for {{transaction.propertyAddress}} is {{transaction.closeDate}}. Ref: {{bogus.field}}.",
      ctx,
    );
    expect(text).toBe("Dear Jordan Bell, closing for 412 Maple Avenue is 2026-08-14. Ref: .");
    expect(unknownKeys).toEqual(["bogus.field"]);
  });

  it("tolerates whitespace inside braces", () => {
    expect(resolveTemplate("{{ today }}", { today: "2026-07-18" }).text).toBe("2026-07-18");
  });
});

describe("renderTemplatePdf", () => {
  it("produces a valid PDF", async () => {
    const pdf = await renderTemplatePdf(
      "Intro Letter",
      "# Welcome\nHello there.\n\nSecond paragraph.",
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });
});
