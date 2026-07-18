import type { EnvelopeStatusResult, EsignAdapter } from "./types.js";

/**
 * Documenso adapter (self-hosted or cloud) via its v1 REST API.
 * Config: DOCUMENSO_URL (e.g. https://sign.example.com) + DOCUMENSO_API_TOKEN.
 *
 * ⚠️ Written against the published v1 API shape but not yet exercised against
 * a live instance (config-gated). First live test may need field tweaks.
 */

function cfg() {
  const url = process.env.DOCUMENSO_URL?.replace(/\/$/, "");
  const token = process.env.DOCUMENSO_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const c = cfg();
  if (!c) throw new Error("Documenso is not configured (DOCUMENSO_URL, DOCUMENSO_API_TOKEN).");
  const res = await fetch(`${c.url}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: c.token,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Documenso ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

function mapStatus(status: string): EnvelopeStatusResult {
  switch (status) {
    case "COMPLETED":
      return { status: "COMPLETED" };
    case "REJECTED":
      return { status: "DECLINED" };
    default:
      return { status: "SENT", detail: status };
  }
}

export const documensoAdapter: EsignAdapter = {
  id: "DOCUMENSO",
  label: "Documenso",
  available: () =>
    cfg()
      ? { ok: true }
      : { ok: false, reason: "Set DOCUMENSO_URL and DOCUMENSO_API_TOKEN in .env" },

  async createEnvelope({ title, pdf, signers }) {
    const createRes = await api("/documents", {
      method: "POST",
      body: JSON.stringify({
        title,
        recipients: signers.map((s, i) => ({
          name: s.name,
          email: s.email,
          role: "SIGNER",
          signingOrder: i + 1,
        })),
      }),
    });
    const created = (await createRes.json()) as { documentId: number; uploadUrl: string };

    const upload = await fetch(created.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: new Uint8Array(pdf),
    });
    if (!upload.ok) throw new Error(`Documenso upload failed: ${upload.status}`);

    await api(`/documents/${created.documentId}/send`, { method: "POST", body: "{}" });
    return { externalId: String(created.documentId) };
  },

  async getStatus(externalId) {
    const res = await api(`/documents/${externalId}`);
    const doc = (await res.json()) as { status: string };
    return mapStatus(doc.status);
  },
};

export const _documensoInternals = { mapStatus };
