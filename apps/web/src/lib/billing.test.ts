import { describe, expect, it } from "vitest";
import {
  creditBalanceCents,
  displayState,
  invoiceMoney,
  invoiceTotalCents,
  maxCreditApplication,
  paidCents,
  settlesInvoice,
} from "./billing";

const lines = (...amounts: number[]) => amounts.map((amountCents) => ({ amountCents }));

describe("invoiceTotalCents", () => {
  it("sums lines, including negative discount lines", () => {
    expect(invoiceTotalCents(lines(35000, 5000, -2500))).toBe(37500);
    expect(invoiceTotalCents([])).toBe(0);
  });
});

describe("paidCents / invoiceMoney", () => {
  it("nets reversals against payments", () => {
    // $350 check, bounced (full reversal), then re-paid by wire.
    expect(paidCents(lines(35000, -35000, 35000))).toBe(35000);
  });

  it("computes balance = total − paid, negative when overpaid", () => {
    const m = invoiceMoney(lines(35000), lines(40000));
    expect(m.balanceCents).toBe(-5000);
  });
});

describe("displayState", () => {
  const paid = invoiceMoney(lines(35000), lines(35000));
  const partial = invoiceMoney(lines(35000), lines(10000));
  const none = invoiceMoney(lines(35000), []);

  it("passes lifecycle states through regardless of ledger", () => {
    expect(displayState("DRAFT", partial)).toBe("draft");
    expect(displayState("VOID", paid)).toBe("void");
  });

  it("trusts an explicit PAID with no ledger rows (ERPNext mirror)", () => {
    expect(displayState("PAID", none)).toBe("paid");
  });

  it("derives unpaid / partial / paid from the ledger while SENT", () => {
    expect(displayState("SENT", none)).toBe("unpaid");
    expect(displayState("SENT", partial)).toBe("partial");
    expect(displayState("SENT", paid)).toBe("paid");
  });

  it("a bounced check drops a settled invoice back to partial or unpaid", () => {
    const bounced = invoiceMoney(lines(35000), lines(35000, -35000));
    expect(displayState("SENT", bounced)).toBe("unpaid");
    const partialBounce = invoiceMoney(lines(35000), lines(35000, -35000, 10000));
    expect(displayState("SENT", partialBounce)).toBe("partial");
  });

  it("does not call a zero-total invoice paid", () => {
    expect(displayState("SENT", invoiceMoney([], []))).toBe("unpaid");
  });
});

describe("settlesInvoice", () => {
  it("settles at exactly zero balance, and when overpaid", () => {
    expect(settlesInvoice(invoiceMoney(lines(35000), lines(35000)))).toBe(true);
    expect(settlesInvoice(invoiceMoney(lines(35000), lines(36000)))).toBe(true);
    expect(settlesInvoice(invoiceMoney(lines(35000), lines(34999)))).toBe(false);
  });

  it("never settles an empty invoice", () => {
    expect(settlesInvoice(invoiceMoney([], []))).toBe(false);
  });
});

describe("client credit", () => {
  it("balances deposits against applications and refunds", () => {
    // $1,000 retainer, $350 applied, $150 refunded → $500 on account.
    expect(creditBalanceCents(lines(100000, -35000, -15000))).toBe(50000);
  });

  it("clamps applications to both the credit and the invoice balance", () => {
    expect(maxCreditApplication(50000, 35000)).toBe(35000); // invoice caps it
    expect(maxCreditApplication(20000, 35000)).toBe(20000); // credit caps it
    expect(maxCreditApplication(0, 35000)).toBe(0);
    expect(maxCreditApplication(-500, 35000)).toBe(0); // never negative
    expect(maxCreditApplication(50000, -100)).toBe(0); // overpaid invoice takes nothing
  });
});
