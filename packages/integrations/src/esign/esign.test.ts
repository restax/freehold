import { describe, expect, it } from "vitest";
import { _documensoInternals, documensoAdapter } from "./documenso.js";
import { _docusignInternals, docusignAdapter } from "./docusign.js";
import { manualAdapter } from "./manual.js";

describe("availability gating", () => {
  it("manual is always available", () => {
    expect(manualAdapter.available().ok).toBe(true);
  });

  it("documenso and docusign are unavailable without env config", () => {
    expect(documensoAdapter.available().ok).toBe(false);
    expect(documensoAdapter.available().reason).toContain("DOCUMENSO_URL");
    expect(docusignAdapter.available().ok).toBe(false);
    expect(docusignAdapter.available().reason).toContain("DOCUSIGN_ACCOUNT_ID");
  });
});

describe("status mapping", () => {
  it("maps documenso statuses", () => {
    expect(_documensoInternals.mapStatus("COMPLETED").status).toBe("COMPLETED");
    expect(_documensoInternals.mapStatus("REJECTED").status).toBe("DECLINED");
    expect(_documensoInternals.mapStatus("PENDING").status).toBe("SENT");
  });

  it("maps docusign statuses", () => {
    expect(_docusignInternals.mapStatus("completed").status).toBe("COMPLETED");
    expect(_docusignInternals.mapStatus("voided").status).toBe("DECLINED");
    expect(_docusignInternals.mapStatus("delivered").status).toBe("SENT");
  });
});

describe("manual envelope flow", () => {
  it("creates with no external id and never self-completes", async () => {
    const created = await manualAdapter.createEnvelope({
      title: "t",
      pdf: Buffer.from("%PDF-"),
      signers: [{ name: "A", email: "a@example.com" }],
    });
    expect(created.externalId).toBeNull();
    expect((await manualAdapter.getStatus("x")).status).toBe("SENT");
  });
});
