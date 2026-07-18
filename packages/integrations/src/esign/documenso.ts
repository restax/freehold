import type { EnvelopeStatusResult, EsignAdapter } from "./types.js";

/**
 * Documenso adapter (self-hosted or cloud) via its v2 REST API.
 * Config: DOCUMENSO_URL (e.g. http://localhost:3030) + DOCUMENSO_API_TOKEN.
 *
 * Verified live 2026-07-18 against a self-hosted instance (see
 * docker-compose.documenso.yml): create is multipart (PDF inline — no S3
 * requirement, unlike the deprecated v1 API), then distribute sends the
 * signing emails.
 */

function cfg() {
  const url = process.env.DOCUMENSO_URL?.replace(/\/$/, "");
  const token = process.env.DOCUMENSO_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const c = cfg();
  if (!c) throw new Error("Documenso is not configured (DOCUMENSO_URL, DOCUMENSO_API_TOKEN).");
  const res = await fetch(`${c.url}/api/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${c.token}`,
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
    case "CANCELLED":
      return { status: "DECLINED", detail: status };
    default: // DRAFT | PENDING
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
    const form = new FormData();
    form.append(
      "payload",
      JSON.stringify({
        title,
        recipients: signers.map((s, i) => ({
          email: s.email,
          name: s.name,
          role: "SIGNER",
          signingOrder: i + 1,
          // Documenso refuses to distribute unless every signer has at least
          // one field. Auto-place signature blocks near the bottom of page 1,
          // stacked per signer (coordinates are percentages).
          fields: [
            {
              type: "SIGNATURE",
              pageNumber: 1,
              pageX: 8,
              pageY: Math.min(70 + i * 12, 88),
              width: 30,
              height: 7,
            },
          ],
        })),
      }),
    );
    const filename = title.toLowerCase().endsWith(".pdf") ? title : `${title}.pdf`;
    form.append("file", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), filename);

    const createRes = await api("/document/create", { method: "POST", body: form });
    const created = (await createRes.json()) as { id: number };

    await api("/document/distribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: created.id }),
    });
    return { externalId: String(created.id) };
  },

  async getStatus(externalId) {
    const res = await api(`/document/${externalId}`);
    const doc = (await res.json()) as { status: string };
    return mapStatus(doc.status);
  },
};

export const _documensoInternals = { mapStatus };
