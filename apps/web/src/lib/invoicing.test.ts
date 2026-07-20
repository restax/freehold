import { describe, expect, it } from "vitest";
import {
  agingBucket,
  daysOverdue,
  invoiceLabel,
  invoiceText,
  outstandingReportText,
} from "./invoicing";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const now = d("2026-07-20");

describe("invoiceLabel", () => {
  it("pads to four digits and keeps growing past them", () => {
    expect(invoiceLabel(1)).toBe("INV-0001");
    expect(invoiceLabel(482)).toBe("INV-0482");
    expect(invoiceLabel(12345)).toBe("INV-12345");
  });
});

describe("agingBucket", () => {
  it("treats no due date as current — we never invent a deadline", () => {
    expect(agingBucket(null, now)).toBe("current");
  });

  it("is current through the due date itself, overdue the day after", () => {
    expect(agingBucket(d("2026-07-20"), now)).toBe("current"); // due today
    expect(agingBucket(d("2026-07-19"), now)).toBe("overdue");
    expect(agingBucket(d("2026-08-01"), now)).toBe("current");
  });

  it("counts days overdue from the day after due", () => {
    expect(daysOverdue(d("2026-07-19"), now)).toBe(1);
    expect(daysOverdue(d("2026-07-01"), now)).toBe(19);
  });
});

describe("invoiceText", () => {
  it("carries every field the client needs", () => {
    const text = invoiceText({
      number: 7,
      workspaceName: "Maplewood Transactions",
      clientName: "Sunrise Realty",
      description: "Coordination — 412 Maple Ave",
      amountCents: 35000,
      paymentTerms: "Due at closing",
      dueDate: d("2026-08-13"),
      issuedOn: now,
      transactionAddress: "412 Maple Ave",
    });
    expect(text).toContain("INV-0007");
    expect(text).toContain("Billed to: Sunrise Realty");
    expect(text).toContain("Amount due: $350.00");
    expect(text).toContain("Terms: Due at closing");
    expect(text).toContain("Due: 2026-08-13");
  });

  it("omits lines for fields that are not set", () => {
    const text = invoiceText({
      number: 1,
      workspaceName: "W",
      clientName: null,
      description: "Services",
      amountCents: 100,
      paymentTerms: null,
      dueDate: null,
      issuedOn: now,
      transactionAddress: null,
    });
    expect(text).not.toContain("Billed to");
    expect(text).not.toContain("Terms:");
    expect(text).not.toContain("Due:");
  });
});

describe("outstandingReportText", () => {
  it("says so when nothing is outstanding", () => {
    expect(outstandingReportText([], "W", now)).toContain("Nothing outstanding");
  });

  it("totals everything and lists overdue before current", () => {
    const text = outstandingReportText(
      [
        { number: 1, clientName: "A", amountCents: 10000, dueDate: d("2026-08-01"), address: null },
        {
          number: 2,
          clientName: "B",
          amountCents: 25000,
          dueDate: d("2026-07-01"),
          address: "88 Harbor Ln",
        },
      ],
      "W",
      now,
    );
    expect(text).toContain("2 outstanding, $350.00 total — 1 overdue");
    expect(text.indexOf("INV-0002")).toBeLessThan(text.indexOf("INV-0001"));
    expect(text).toContain("19d overdue");
    expect(text).toContain("due 2026-08-01");
  });
});
