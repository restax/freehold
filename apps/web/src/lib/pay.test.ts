import { describe, expect, it } from "vitest";
import { fmtCents, parseFeeCents, statementCsv, statementText, totalCents } from "./pay";

describe("parseFeeCents", () => {
  it("reads plain dollars", () => {
    expect(parseFeeCents("350")).toBe(35000);
  });

  it("reads cents exactly — no floating-point drift", () => {
    expect(parseFeeCents("0.10")).toBe(10);
    expect(parseFeeCents("1.15")).toBe(115);
    expect(parseFeeCents("19.99")).toBe(1999);
  });

  it("tolerates currency formatting", () => {
    expect(parseFeeCents("$1,250.00")).toBe(125000);
    expect(parseFeeCents("  450 ")).toBe(45000);
  });

  it("returns null for blank or nonsense", () => {
    expect(parseFeeCents("")).toBeNull();
    expect(parseFeeCents("free")).toBeNull();
    expect(parseFeeCents("1.234")).toBeNull(); // more precision than money has
    expect(parseFeeCents("-50")).toBeNull();
  });

  it("accepts zero — a deliberately unpaid assignment", () => {
    expect(parseFeeCents("0")).toBe(0);
  });
});

describe("fmtCents", () => {
  it("always shows two decimals with thousands separators", () => {
    expect(fmtCents(125000)).toBe("$1,250.00");
    expect(fmtCents(5)).toBe("$0.05");
    expect(fmtCents(0)).toBe("$0.00");
  });
});

describe("totalCents", () => {
  it("sums in integer cents", () => {
    expect(totalCents([{ feeCents: 1015 }, { feeCents: 2030 }])).toBe(3045);
  });

  it("is zero for an empty request", () => {
    expect(totalCents([])).toBe(0);
  });
});

describe("statementText", () => {
  const lines = [
    { address: "412 Maple Ave", feeCents: 35000 },
    { address: "88 Harbor Ln", feeCents: 42500 },
  ];

  it("lists every line and the total", () => {
    const out = statementText(lines, "Dana Reed", "Maplewood", "2026-07-20");
    expect(out).toContain("412 Maple Ave");
    expect(out).toContain("$350.00");
    expect(out).toContain("2 transactions:");
    expect(out).toContain("Total: $775.00");
  });

  it("says transaction, singular, for one line", () => {
    expect(statementText([lines[0]], "Dana Reed", "Maplewood", "2026-07-20")).toContain(
      "1 transaction:",
    );
  });
});

describe("statementCsv", () => {
  it("emits a header and one row per line", () => {
    const csv = statementCsv([{ address: "412 Maple Ave", feeCents: 35000 }], "Dana Reed");
    expect(csv.split("\n")).toEqual([
      "Transaction,Payee,Amount",
      '"412 Maple Ave","Dana Reed",350.00',
    ]);
  });

  it("escapes quotes and commas in addresses", () => {
    const csv = statementCsv([{ address: 'Unit 3, "The Lofts"', feeCents: 100 }], "Dana Reed");
    expect(csv).toContain('"Unit 3, ""The Lofts"""');
  });
});
