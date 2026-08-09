import { describe, expect, it } from "vitest";
import {
  enforcedSide,
  hitsSettlement,
  isLendingSide,
  isSettled,
  LENDING_DOCUMENTS,
  type PaymentSlot,
  packageWording,
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
