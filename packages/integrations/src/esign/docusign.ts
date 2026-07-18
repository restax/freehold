import { importPKCS8, SignJWT } from "jose";
import type { EnvelopeStatusResult, EsignAdapter } from "./types.js";

/**
 * DocuSign adapter using the JWT (service-integration) grant.
 * Config: DOCUSIGN_ACCOUNT_ID, DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID,
 * DOCUSIGN_PRIVATE_KEY (RSA PEM, \n-escaped allowed), plus optional
 * DOCUSIGN_BASE_URL / DOCUSIGN_OAUTH_BASE (default to the developer sandbox).
 *
 * ⚠️ Written against the published eSignature REST v2.1 shape but not yet
 * exercised live (config-gated). The integration key must have the user's
 * one-time consent granted in DocuSign before the JWT grant works.
 */

function cfg() {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  const userId = process.env.DOCUSIGN_USER_ID;
  const privateKey = process.env.DOCUSIGN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!accountId || !integrationKey || !userId || !privateKey) return null;
  return {
    accountId,
    integrationKey,
    userId,
    privateKey,
    baseUrl: (process.env.DOCUSIGN_BASE_URL ?? "https://demo.docusign.net/restapi").replace(
      /\/$/,
      "",
    ),
    oauthBase: (process.env.DOCUSIGN_OAUTH_BASE ?? "https://account-d.docusign.com").replace(
      /\/$/,
      "",
    ),
  };
}

async function accessToken(): Promise<string> {
  const c = cfg();
  if (!c) throw new Error("DocuSign is not configured.");
  const key = await importPKCS8(c.privateKey, "RS256");
  const assertion = await new SignJWT({ scope: "signature impersonation" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(c.integrationKey)
    .setSubject(c.userId)
    .setAudience(new URL(c.oauthBase).host)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);

  const res = await fetch(`${c.oauthBase}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`DocuSign auth failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

function mapStatus(status: string): EnvelopeStatusResult {
  switch (status) {
    case "completed":
      return { status: "COMPLETED" };
    case "declined":
    case "voided":
      return { status: "DECLINED", detail: status };
    default:
      return { status: "SENT", detail: status };
  }
}

export const docusignAdapter: EsignAdapter = {
  id: "DOCUSIGN",
  label: "DocuSign",
  available: () =>
    cfg()
      ? { ok: true }
      : {
          ok: false,
          reason:
            "Set DOCUSIGN_ACCOUNT_ID, DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_PRIVATE_KEY in .env",
        },

  async createEnvelope({ title, pdf, signers }) {
    const c = cfg();
    if (!c) throw new Error("DocuSign is not configured.");
    const token = await accessToken();
    const res = await fetch(`${c.baseUrl}/v2.1/accounts/${c.accountId}/envelopes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        emailSubject: title,
        status: "sent",
        documents: [
          {
            documentBase64: pdf.toString("base64"),
            name: title,
            fileExtension: "pdf",
            documentId: "1",
          },
        ],
        recipients: {
          signers: signers.map((s, i) => ({
            name: s.name,
            email: s.email,
            recipientId: String(i + 1),
            routingOrder: String(i + 1),
          })),
        },
      }),
    });
    if (!res.ok) throw new Error(`DocuSign envelope failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { envelopeId: string };
    return { externalId: json.envelopeId };
  },

  async getStatus(externalId) {
    const c = cfg();
    if (!c) throw new Error("DocuSign is not configured.");
    const token = await accessToken();
    const res = await fetch(`${c.baseUrl}/v2.1/accounts/${c.accountId}/envelopes/${externalId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`DocuSign status failed: ${res.status}`);
    const json = (await res.json()) as { status: string };
    return mapStatus(json.status);
  },
};

export const _docusignInternals = { mapStatus };
