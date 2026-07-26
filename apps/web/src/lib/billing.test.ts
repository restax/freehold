import { describe, expect, it } from "vitest";
import {
  type AttributableInvoice,
  billingExceptions,
  creditBalanceCents,
  displayState,
  invoiceMoney,
  invoiceTotalCents,
  maxCreditApplication,
  paidCents,
  settlesInvoice,
  transactionBilling,
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

const inv = (over: Partial<AttributableInvoice>): AttributableInvoice => ({
  status: "SENT",
  provider: "freehold",
  transactionId: null,
  amountCents: 0,
  lines: [],
  payments: [],
  ...over,
});

describe("transactionBilling", () => {
  it("attributes single-file invoices via the invoice-level link", () => {
    const s = transactionBilling("t1", [
      inv({
        transactionId: "t1",
        lines: [{ transactionId: null, amountCents: 35000 }],
        payments: [{ amountCents: 10000 }],
      }),
    ]);
    expect(s).toEqual({ billedCents: 35000, paidCents: 10000 });
  });

  it("pro-rates payments on consolidated invoices by the file's share", () => {
    // $700 invoice, half about t1; half of the invoice is paid → t1 gets $175.
    const s = transactionBilling("t1", [
      inv({
        lines: [
          { transactionId: "t1", amountCents: 35000 },
          { transactionId: "t2", amountCents: 35000 },
        ],
        payments: [{ amountCents: 35000 }],
      }),
    ]);
    expect(s).toEqual({ billedCents: 35000, paidCents: 17500 });
  });

  it("line-level links beat the invoice-level link", () => {
    const s = transactionBilling("t2", [
      inv({
        transactionId: "t1",
        lines: [
          { transactionId: null, amountCents: 10000 }, // inherits t1
          { transactionId: "t2", amountCents: 5000 },
        ],
      }),
    ]);
    expect(s.billedCents).toBe(5000);
  });

  it("ignores DRAFT and VOID invoices entirely", () => {
    const lines = [{ transactionId: "t1", amountCents: 35000 }];
    expect(
      transactionBilling("t1", [
        inv({ status: "DRAFT", lines, payments: [{ amountCents: 35000 }] }),
        inv({ status: "VOID", lines, payments: [{ amountCents: 35000 }] }),
      ]),
    ).toEqual({ billedCents: 0, paidCents: 0 });
  });

  it("counts an ERPNext PAID invoice as fully collected without ledger rows", () => {
    const s = transactionBilling("t1", [
      inv({
        provider: "erpnext",
        status: "PAID",
        transactionId: "t1",
        lines: [{ transactionId: null, amountCents: 35000 }],
      }),
    ]);
    expect(s.paidCents).toBe(35000);
  });

  it("nets a bounced check out of the file's paid figure", () => {
    const s = transactionBilling("t1", [
      inv({
        transactionId: "t1",
        lines: [{ transactionId: null, amountCents: 35000 }],
        payments: [{ amountCents: 35000 }, { amountCents: -35000 }],
      }),
    ]);
    expect(s.paidCents).toBe(0);
  });
});

describe("billingExceptions", () => {
  const closed = (id: string, expected: number | null) => ({
    id,
    propertyAddress: id,
    status: "CLOSED",
    expectedFeeCents: expected,
  });
  const summary = (billed: Record<string, number>) => (id: string) => ({
    billedCents: billed[id] ?? 0,
    paidCents: 0,
  });

  it("flags closed files billed nothing or short, worst first", () => {
    const out = billingExceptions(
      [closed("a", 35000), closed("b", 35000), closed("c", 35000)],
      summary({ b: 10000, c: 35000 }),
    );
    expect(out.map((e) => [e.id, e.kind, e.shortfallCents])).toEqual([
      ["a", "unbilled_closed", 35000],
      ["b", "underbilled_closed", 25000],
    ]);
  });

  it("never flags open files, no-charge files, or files with no fee set", () => {
    const out = billingExceptions(
      [
        { ...closed("open", 35000), status: "UNDER_CONTRACT" },
        closed("nocharge", 0),
        closed("unset", null),
      ],
      summary({}),
    );
    expect(out).toEqual([]);
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
