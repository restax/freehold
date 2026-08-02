/**
 * E-signature adapter contract. App code (server actions) talks only to this
 * interface; provider specifics stay inside each adapter. Adapters are
 * config-gated: `available()` reports whether the environment carries the
 * credentials the provider needs, and why not when it doesn't.
 */

export type EsignProviderId = "MANUAL" | "DOCUMENSO" | "DOCUSIGN" | "OPENSIGN";

export interface EnvelopeSigner {
  name: string;
  email: string;
}

export interface CreateEnvelopeInput {
  title: string;
  pdf: Buffer;
  signers: EnvelopeSigner[];
}

export interface CreateEnvelopeResult {
  /** Provider-side id; null for providers with no external system (MANUAL). */
  externalId: string | null;
  /**
   * Direct per-signer links, set only by providers that don't email the
   * signer themselves. Documenso/DocuSign are real hosted accounts that
   * notify signers natively, so this stays undefined for them — Freehold
   * would just be duplicating a notification that already went out. OpenSign
   * is the one provider Freehold operates itself with no mail configured, so
   * it hands these back and app code is responsible for notifying.
   */
  signerLinks?: Array<{ email: string; url: string }>;
}

export type EnvelopeExternalStatus = "SENT" | "COMPLETED" | "DECLINED";

export interface EnvelopeStatusResult {
  status: EnvelopeExternalStatus;
  detail?: string;
  /** Set only when the provider hands back a fetchable signed copy on completion (OpenSign so far). */
  signedFileUrl?: string;
}

export interface Availability {
  ok: boolean;
  reason?: string;
}

export interface EsignAdapter {
  id: EsignProviderId;
  label: string;
  available(): Availability;
  createEnvelope(input: CreateEnvelopeInput): Promise<CreateEnvelopeResult>;
  getStatus(externalId: string): Promise<EnvelopeStatusResult>;
}
