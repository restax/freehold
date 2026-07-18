import type { EsignAdapter } from "./types.js";

/**
 * MANUAL provider: tracks signatures collected outside any integrated e-sign
 * service — wet ink, or a provider portal we don't integrate yet. Always
 * available; completion is recorded by the user in the app ("Mark signed"),
 * so `getStatus` never advances an envelope on its own.
 */
export const manualAdapter: EsignAdapter = {
  id: "MANUAL",
  label: "Manual / outside Freehold",
  available: () => ({ ok: true }),
  createEnvelope: async () => ({ externalId: null }),
  getStatus: async () => ({ status: "SENT", detail: "Manual envelopes are completed in-app." }),
};
