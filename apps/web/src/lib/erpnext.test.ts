import { describe, expect, it } from "vitest";
import { erpnextInvoiceUrl, mirrorStatus, parseErpnextConfig } from "./erpnext";

describe("mirrorStatus", () => {
  it("maps Paid to paid", () => {
    expect(mirrorStatus("Paid")).toBe("PAID");
    expect(mirrorStatus("paid")).toBe("PAID");
  });

  it("maps the cancelling outcomes to void", () => {
    expect(mirrorStatus("Cancelled")).toBe("VOID");
    expect(mirrorStatus("Return")).toBe("VOID");
    expect(mirrorStatus("Credit Note Issued")).toBe("VOID");
  });

  it("treats a cancelled docstatus as void whatever the status says", () => {
    expect(mirrorStatus("Paid", 2)).toBe("VOID");
  });

  it("leaves every in-flight status outstanding", () => {
    for (const s of ["Draft", "Unpaid", "Overdue", "Partly Paid", "Submitted"]) {
      expect(mirrorStatus(s)).toBe("SENT");
    }
  });

  it("defaults an unknown status to outstanding — never to paid", () => {
    // ERPNext's vocabulary varies by version; guessing "paid" would tell a
    // tenant they've been paid when they haven't.
    expect(mirrorStatus("Some Future Status")).toBe("SENT");
    expect(mirrorStatus("")).toBe("SENT");
  });
});

describe("parseErpnextConfig", () => {
  const good = { url: "https://erp.example", keyEnc: {}, secretEnc: {} };

  it("accepts a fully-formed config", () => {
    expect(parseErpnextConfig(good)).not.toBeNull();
  });

  it("rejects anything missing a url or either secret", () => {
    expect(parseErpnextConfig(null)).toBeNull();
    expect(parseErpnextConfig({})).toBeNull();
    expect(parseErpnextConfig({ ...good, url: "" })).toBeNull();
    expect(parseErpnextConfig({ url: good.url, keyEnc: {} })).toBeNull();
  });
});

describe("erpnextInvoiceUrl", () => {
  it("builds a deep link into the tenant's own instance", () => {
    expect(erpnextInvoiceUrl("https://erp.example", "ACC-SINV-2026-00007")).toBe(
      "https://erp.example/app/sales-invoice/ACC-SINV-2026-00007",
    );
  });

  it("tolerates a trailing slash on the stored URL", () => {
    expect(erpnextInvoiceUrl("https://erp.example/", "X-1")).toBe(
      "https://erp.example/app/sales-invoice/X-1",
    );
  });
});
