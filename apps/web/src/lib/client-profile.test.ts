import { describe, expect, it } from "vitest";
import {
  billingContactFrom,
  brokerageInfoFrom,
  clientKind,
  invoiceRecipient,
} from "./client-profile";

describe("clientKind", () => {
  it("splits the world into individual, office, company", () => {
    expect(clientKind("AGENT")).toBe("individual");
    expect(clientKind("BROKERAGE")).toBe("office");
    expect(clientKind("TEAM")).toBe("office");
    expect(clientKind("TITLE")).toBe("company");
    expect(clientKind("LENDER")).toBe("company");
    expect(clientKind("OTHER")).toBe("company");
  });
});

describe("billingContactFrom", () => {
  it("parses a full contact and trims whitespace", () => {
    expect(
      billingContactFrom({ name: " Dana Whitfield ", email: "ap@office.example", phone: "" }),
    ).toEqual({ name: "Dana Whitfield", email: "ap@office.example", phone: null });
  });

  it("reads malformed or empty JSON as not set", () => {
    expect(billingContactFrom(null)).toBeNull();
    expect(billingContactFrom("billing")).toBeNull();
    expect(billingContactFrom([])).toBeNull();
    expect(billingContactFrom({ name: "", email: "  " })).toBeNull();
    expect(billingContactFrom({ email: 42 })).toBeNull();
  });
});

describe("brokerageInfoFrom", () => {
  it("any one field is enough to count as set", () => {
    expect(brokerageInfoFrom({ name: "Harborline Realty" })).toEqual({
      name: "Harborline Realty",
      phone: null,
      address: null,
    });
    expect(brokerageInfoFrom({})).toBeNull();
  });
});

describe("invoiceRecipient", () => {
  it("billing contact email wins over the client email", () => {
    expect(
      invoiceRecipient({
        email: "broker@office.example",
        billingContact: { name: "AP desk", email: "ap@office.example" },
      }),
    ).toBe("ap@office.example");
  });

  it("falls back to the client email when the contact has no email", () => {
    expect(
      invoiceRecipient({
        email: "broker@office.example",
        billingContact: { name: "AP desk", phone: "555-0100" },
      }),
    ).toBe("broker@office.example");
    expect(invoiceRecipient({ email: "broker@office.example", billingContact: null })).toBe(
      "broker@office.example",
    );
  });

  it("nowhere to send when neither has an email", () => {
    expect(invoiceRecipient({ email: null, billingContact: { name: "AP desk" } })).toBeNull();
  });
});
