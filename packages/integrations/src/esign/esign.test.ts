import { describe, expect, it } from "vitest";
import { _documensoInternals, documensoAdapter, makeDocumensoAdapter } from "./documenso.js";
import { _docusignInternals, docusignAdapter } from "./docusign.js";
import { manualAdapter } from "./manual.js";
import { _openSignInternals, makeOpenSignAdapter } from "./opensign.js";

describe("availability gating", () => {
  it("manual is always available", () => {
    expect(manualAdapter.available().ok).toBe(true);
  });

  it("documenso and docusign are unavailable without env config", () => {
    expect(documensoAdapter.available().ok).toBe(false);
    expect(documensoAdapter.available().reason).toContain("Connect Documenso");
    expect(docusignAdapter.available().ok).toBe(false);
    expect(docusignAdapter.available().reason).toContain("DOCUSIGN_ACCOUNT_ID");
  });

  it("a per-tenant override makes documenso available", () => {
    const bound = makeDocumensoAdapter({ url: "https://sign.example.com", token: "tok" });
    expect(bound.available().ok).toBe(true);
  });

  it("opensign is unavailable without platform env config", () => {
    const adapter = makeOpenSignAdapter();
    expect(adapter.available().ok).toBe(false);
    expect(adapter.available().reason).toContain("FREEHOLD_OPENSIGN_URL");
  });
});

describe("status mapping", () => {
  it("maps documenso statuses", () => {
    expect(_documensoInternals.mapStatus("COMPLETED").status).toBe("COMPLETED");
    expect(_documensoInternals.mapStatus("REJECTED").status).toBe("DECLINED");
    expect(_documensoInternals.mapStatus("CANCELLED").status).toBe("DECLINED");
    expect(_documensoInternals.mapStatus("PENDING").status).toBe("SENT");
    expect(_documensoInternals.mapStatus("DRAFT").status).toBe("SENT");
  });

  it("maps docusign statuses", () => {
    expect(_docusignInternals.mapStatus("completed").status).toBe("COMPLETED");
    expect(_docusignInternals.mapStatus("voided").status).toBe("DECLINED");
    expect(_docusignInternals.mapStatus("delivered").status).toBe("SENT");
  });

  it("maps opensign document state", () => {
    expect(_openSignInternals.mapStatus({ SignedUrl: "https://x/signed.pdf" }).status).toBe(
      "COMPLETED",
    );
    expect(_openSignInternals.mapStatus({ IsDeclined: true }).status).toBe("DECLINED");
    expect(_openSignInternals.mapStatus({}).status).toBe("SENT");
    expect(_openSignInternals.mapStatus(undefined).status).toBe("SENT");
  });

  it("builds the guest-signing link the way GuestLogin.jsx decodes it", () => {
    const prevUrl = process.env.FREEHOLD_OPENSIGN_URL;
    const prevAppId = process.env.FREEHOLD_OPENSIGN_APP_ID;
    process.env.FREEHOLD_OPENSIGN_URL = "https://sign.example.com/";
    process.env.FREEHOLD_OPENSIGN_APP_ID = "opensign";
    try {
      const url = _openSignInternals.signInUrl("doc123", "signer@example.com");
      expect(url).toBe(
        `https://sign.example.com/login/${Buffer.from("doc123/signer@example.com").toString("base64")}`,
      );
      const [docId, email] = Buffer.from(url.split("/login/")[1], "base64").toString().split("/");
      expect(docId).toBe("doc123");
      expect(email).toBe("signer@example.com");
    } finally {
      if (prevUrl === undefined) delete process.env.FREEHOLD_OPENSIGN_URL;
      else process.env.FREEHOLD_OPENSIGN_URL = prevUrl;
      if (prevAppId === undefined) delete process.env.FREEHOLD_OPENSIGN_APP_ID;
      else process.env.FREEHOLD_OPENSIGN_APP_ID = prevAppId;
    }
  });
});

describe("opensign envelope flow", () => {
  it("throws a clear error when called with no provisioned session", async () => {
    const adapter = makeOpenSignAdapter();
    await expect(
      adapter.createEnvelope({
        title: "Contract",
        pdf: Buffer.from("%PDF-"),
        signers: [{ name: "A", email: "a@example.com" }],
      }),
    ).rejects.toThrow(/no session/i);
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
