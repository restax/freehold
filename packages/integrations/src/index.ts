import { documensoAdapter } from "./esign/documenso.js";
import { docusignAdapter } from "./esign/docusign.js";
import { manualAdapter } from "./esign/manual.js";
import type { EsignAdapter, EsignProviderId } from "./esign/types.js";

export type {
  Availability,
  CreateEnvelopeInput,
  CreateEnvelopeResult,
  EnvelopeExternalStatus,
  EnvelopeSigner,
  EnvelopeStatusResult,
  EsignAdapter,
  EsignProviderId,
} from "./esign/types.js";
export { documensoAdapter, docusignAdapter, manualAdapter };

const ADAPTERS: Record<EsignProviderId, EsignAdapter> = {
  MANUAL: manualAdapter,
  DOCUMENSO: documensoAdapter,
  DOCUSIGN: docusignAdapter,
};

export function getEsignAdapter(id: EsignProviderId): EsignAdapter {
  return ADAPTERS[id];
}

export function listEsignAdapters(): EsignAdapter[] {
  return Object.values(ADAPTERS);
}

export * from "./webhooks.js";
