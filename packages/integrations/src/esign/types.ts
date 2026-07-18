/**
 * E-signature adapter contract. App code (server actions) talks only to this
 * interface; provider specifics stay inside each adapter. Adapters are
 * config-gated: `available()` reports whether the environment carries the
 * credentials the provider needs, and why not when it doesn't.
 */

export type EsignProviderId = "MANUAL" | "DOCUMENSO" | "DOCUSIGN";

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
}

export type EnvelopeExternalStatus = "SENT" | "COMPLETED" | "DECLINED";

export interface EnvelopeStatusResult {
  status: EnvelopeExternalStatus;
  detail?: string;
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
