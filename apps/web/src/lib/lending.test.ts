import { describe, expect, it } from "vitest";
import {
  EMPTY_LENDING_TERMS,
  enforcedSide,
  hasLoanTerms,
  hitsSettlement,
  isLendingSide,
  isSettled,
  LENDING_DOCUMENTS,
  loanMetrics,
  maturityDate,
  type PaymentSlot,
  packageWording,
  parseLendingTerms,
  paymentRollup,
} from "./lending";

const slot = (over: Partial<PaymentSlot> = {}): PaymentSlot => ({
  name: "Invoice for appraisal",
  paymentTracked: true,
  paymentStatus: null,
  ...over,
});

describe("LENDING_DOCUMENTS", () => {
  it("tracks payment on exactly the two invoices", () => {
    const tracked = LENDING_DOCUMENTS.filter((d) => d.paymentTracked).map((d) => d.name);
    expect(tracked).toEqual(["Invoice for appraisal", "Insurance invoice or receipt"]);
  });

  it("carries the aliases for the documents that have them", () => {
    // These are called different things state to state, and a processor
    // looking for "Articles of Formation" needs to recognise the line.
    const articles = LENDING_DOCUMENTS.find((d) => d.name === "Articles of Incorporation");
    expect(articles?.description).toContain("Articles of Formation");
    const standing = LENDING_DOCUMENTS.find((d) => d.name === "Certificate of Good Standing");
    expect(standing?.description).toContain("Certificate of Existence");
  });

  it("names every document once", () => {
    const names = LENDING_DOCUMENTS.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("ends on the HUD, which does not exist until the rest is done", () => {
    expect(LENDING_DOCUMENTS.at(-1)?.name).toBe("Copy of the HUD");
  });
});

describe("isSettled / hitsSettlement", () => {
  it("counts COD as settled", () => {
    expect(isSettled("PAID_COD")).toBe(true);
    expect(isSettled("PAID_IN_FULL")).toBe(true);
  });

  it("puts anything unsettled on the settlement statement", () => {
    expect(hitsSettlement("DUE_AT_CLOSING")).toBe(true);
    expect(hitsSettlement("UNPAID")).toBe(true);
  });

  it("treats no answer as still owing", () => {
    // Silence is not evidence something was paid, and the cost quietly
    // missing the HUD is the failure this exists to prevent.
    expect(hitsSettlement(null)).toBe(true);
    expect(isSettled(null)).toBe(false);
  });
});

describe("paymentRollup", () => {
  it("ignores documents that carry no payment question", () => {
    const rollup = paymentRollup([
      slot({ name: "Appraisal", paymentTracked: false }),
      slot({ name: "Invoice for appraisal", paymentStatus: "PAID_COD" }),
    ]);
    expect(rollup.tracked).toBe(1);
    expect(rollup.settled).toBe(1);
    expect(rollup.atClosing).toEqual([]);
  });

  it("names what still lands on the settlement statement", () => {
    const rollup = paymentRollup([
      slot({ name: "Invoice for appraisal", paymentStatus: "PAID_IN_FULL" }),
      slot({ name: "Insurance invoice or receipt", paymentStatus: "DUE_AT_CLOSING" }),
    ]);
    expect(rollup.atClosing).toEqual(["Insurance invoice or receipt"]);
    expect(rollup.settled).toBe(1);
  });

  it("separates unanswered from answered-and-owing", () => {
    const rollup = paymentRollup([
      slot({ name: "Invoice for appraisal", paymentStatus: null }),
      slot({ name: "Insurance invoice or receipt", paymentStatus: "DUE_AT_CLOSING" }),
    ]);
    expect(rollup.unanswered).toEqual(["Invoice for appraisal"]);
    expect(rollup.atClosing).toEqual(["Invoice for appraisal", "Insurance invoice or receipt"]);
  });

  it("is empty on a file with no invoices", () => {
    expect(paymentRollup([])).toEqual({ tracked: 0, settled: 0, atClosing: [], unanswered: [] });
  });
});

describe("packageWording", () => {
  it("says underwriting on a lending file", () => {
    expect(packageWording("BORROWER").submit).toBe("Send to underwriting");
  });

  it("keeps the compliance wording on a sale", () => {
    expect(packageWording("BUY_SIDE").submit).toBe("Submit for review");
    expect(packageWording(null).title).toBe("Compliance");
  });
});

describe("isLendingSide", () => {
  it("recognises only the borrower side", () => {
    expect(isLendingSide("BORROWER")).toBe(true);
    expect(isLendingSide("DUAL")).toBe(false);
    expect(isLendingSide(undefined)).toBe(false);
  });
});

describe("enforcedSide", () => {
  const lending = { privateLendingEnabled: true };

  it("puts a private lender's file on the borrower side whatever was posted", () => {
    expect(enforcedSide({ requested: "SELL_SIDE", clientType: "PRIVATE_LENDER", ...lending })).toBe(
      "BORROWER",
    );
  });

  it("refuses the borrower side to an ordinary client", () => {
    // A hand-posted BORROWER would otherwise put a sale file on a layout with
    // no buy or sell side.
    expect(enforcedSide({ requested: "BORROWER", clientType: "AGENT", ...lending })).toBe(
      "BUY_SIDE",
    );
    expect(enforcedSide({ requested: "BORROWER", clientType: null, ...lending })).toBe("BUY_SIDE");
  });

  it("leaves ordinary sides alone", () => {
    expect(enforcedSide({ requested: "DUAL", clientType: "BROKERAGE", ...lending })).toBe("DUAL");
  });

  it("returns lending files to a sale side when the switch goes off", () => {
    expect(
      enforcedSide({
        requested: "BORROWER",
        clientType: "PRIVATE_LENDER",
        privateLendingEnabled: false,
      }),
    ).toBe("BUY_SIDE");
  });

  it("keeps a file on its existing side when one is given as the fallback", () => {
    // Editing a sale file whose form didn't carry a side shouldn't silently
    // flip it to buy side.
    expect(
      enforcedSide({
        requested: "BORROWER",
        clientType: "AGENT",
        privateLendingEnabled: true,
        fallback: "SELL_SIDE",
      }),
    ).toBe("SELL_SIDE");
  });
});

describe("parseLendingTerms", () => {
  it("reads a full set of terms", () => {
    const t = parseLendingTerms({
      purpose: "BRIDGE",
      loanAmountCents: 50_000_000,
      ratePct: 11.5,
      termMonths: 12,
      points: 2,
      appraisedValueCents: 80_000_000,
      borrower: "  Ironworks Holdings LLC  ",
      guarantor: "Dana Whitfield",
      entityState: "de",
    });
    expect(t.purpose).toBe("BRIDGE");
    expect(t.loanAmountCents).toBe(50_000_000);
    expect(t.borrower).toBe("Ironworks Holdings LLC");
    expect(t.entityState).toBe("DE");
  });

  it("treats the column as hostile", () => {
    // A hand-edited row must not put Infinity or a negative rate on screen.
    for (const junk of [null, undefined, "a string", [], 42]) {
      expect(parseLendingTerms(junk)).toEqual(EMPTY_LENDING_TERMS);
    }
    const t = parseLendingTerms({
      loanAmountCents: Number.POSITIVE_INFINITY,
      ratePct: -5,
      termMonths: Number.NaN,
      points: "2",
      purpose: "SOMETHING_ELSE",
      borrower: { nope: true },
    });
    expect(t).toEqual(EMPTY_LENDING_TERMS);
  });

  it("is empty until something is filled in", () => {
    expect(hasLoanTerms(EMPTY_LENDING_TERMS)).toBe(false);
    expect(hasLoanTerms({ ...EMPTY_LENDING_TERMS, ratePct: 10 })).toBe(true);
    expect(hasLoanTerms({ ...EMPTY_LENDING_TERMS, borrower: "Acme LLC" })).toBe(true);
  });
});

describe("loanMetrics", () => {
  const terms = parseLendingTerms({
    loanAmountCents: 50_000_000,
    ratePct: 12,
    termMonths: 12,
    points: 2,
    appraisedValueCents: 80_000_000,
  });

  it("measures the loan against the appraisal and against the price", () => {
    // The two diverge when the buy is under market, which is the thesis of
    // most of these deals, so both are worth showing.
    const m = loanMetrics(terms, 62_500_000);
    expect(m.ltvPct).toBe(62.5);
    expect(m.ltcPct).toBe(80);
  });

  it("figures interest-only carry and origination", () => {
    const m = loanMetrics(terms, null);
    expect(m.monthlyInterestCents).toBe(500_000);
    expect(m.originationFeeCents).toBe(1_000_000);
    expect(m.totalCostCents).toBe(500_000 * 12 + 1_000_000);
  });

  it("returns null rather than Infinity or a guess", () => {
    const m = loanMetrics(parseLendingTerms({ loanAmountCents: 50_000_000 }), 0);
    expect(m.ltvPct).toBeNull();
    expect(m.ltcPct).toBeNull();
    expect(m.monthlyInterestCents).toBeNull();
    expect(m.totalCostCents).toBeNull();
  });
});

describe("maturityDate", () => {
  it("adds the term to the closing date", () => {
    const d = maturityDate(new Date(Date.UTC(2026, 0, 15)), 12);
    expect(d?.toISOString().slice(0, 10)).toBe("2027-01-15");
  });

  it("clamps to the end of a shorter month", () => {
    // A twelve-month loan closing on the 31st must not roll into March.
    const d = maturityDate(new Date(Date.UTC(2025, 7, 31)), 6);
    expect(d?.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("has no answer without both a date and a term", () => {
    expect(maturityDate(null, 12)).toBeNull();
    expect(maturityDate(new Date(), null)).toBeNull();
    expect(maturityDate(new Date(), 0)).toBeNull();
  });
});
