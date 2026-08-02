import { type DocumensoConfig, documensoAdapter, makeDocumensoAdapter } from "./esign/documenso.js";
import { docusignAdapter } from "./esign/docusign.js";
import { manualAdapter } from "./esign/manual.js";
import { createOpenSignUser, makeOpenSignAdapter, type OpenSignConfig } from "./esign/opensign.js";
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
export type { DocumensoConfig, OpenSignConfig };
export {
  createOpenSignUser,
  documensoAdapter,
  docusignAdapter,
  makeDocumensoAdapter,
  makeOpenSignAdapter,
  manualAdapter,
};

const ADAPTERS: Record<EsignProviderId, EsignAdapter> = {
  MANUAL: manualAdapter,
  DOCUMENSO: documensoAdapter,
  DOCUSIGN: docusignAdapter,
  OPENSIGN: makeOpenSignAdapter(),
};

/** Per-tenant credential overrides; anything omitted falls back to env. */
export interface EsignOverrides {
  documenso?: DocumensoConfig;
  opensign?: OpenSignConfig;
}

export function getEsignAdapter(id: EsignProviderId, overrides?: EsignOverrides): EsignAdapter {
  if (id === "DOCUMENSO" && overrides?.documenso) return makeDocumensoAdapter(overrides.documenso);
  if (id === "OPENSIGN" && overrides?.opensign) return makeOpenSignAdapter(overrides.opensign);
  return ADAPTERS[id];
}

export function listEsignAdapters(): EsignAdapter[] {
  return Object.values(ADAPTERS);
}

export * from "./webhooks.js";
