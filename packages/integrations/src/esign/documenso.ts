import type { EnvelopeStatusResult, EsignAdapter } from "./types.js";

/**
 * Documenso adapter (self-hosted or cloud) via its v2 REST API.
 * Config: an explicit {url, token} override (per-tenant connections on
 * Cloud), else DOCUMENSO_URL (e.g. http://localhost:3030) +
 * DOCUMENSO_API_TOKEN as the server-wide default.
 *
 * Verified live 2026-07-18 against a self-hosted instance (see
 * docker-compose.documenso.yml): create is multipart (PDF inline — no S3
 * requirement, unlike the deprecated v1 API), then distribute sends the
 * signing emails.
 */

export interface DocumensoConfig {
  url: string;
  token: string;
}

function envCfg(): DocumensoConfig | null {
  const url = process.env.DOCUMENSO_URL?.replace(/\/$/, "");
  const token = process.env.DOCUMENSO_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function api(
  override: DocumensoConfig | undefined,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const c = override ? { ...override, url: override.url.replace(/\/$/, "") } : envCfg();
  if (!c) throw new Error("Documenso is not connected for this workspace.");
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

export function makeDocumensoAdapter(override?: DocumensoConfig): EsignAdapter {
  return {
    id: "DOCUMENSO",
    label: "Documenso",
    available: () =>
      override || envCfg()
        ? { ok: true }
        : { ok: false, reason: "Connect Documenso for this workspace" },

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

      const createRes = await api(override, "/document/create", { method: "POST", body: form });
      const created = (await createRes.json()) as { id: number };

      await api(override, "/document/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: created.id }),
      });
      return { externalId: String(created.id) };
    },

    async getStatus(externalId) {
      const res = await api(override, `/document/${externalId}`);
      const doc = (await res.json()) as { status: string };
      return mapStatus(doc.status);
    },
  };
}

export const documensoAdapter: EsignAdapter = makeDocumensoAdapter();

export const _documensoInternals = { mapStatus };
