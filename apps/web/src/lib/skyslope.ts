import { decryptSecret, encryptSecret, loadMasterKey } from "@freehold/vault";

/**
 * SkySlope credentials, stored per client.
 *
 * SkySlope's Transaction Management API authenticates in two layers:
 *
 *   ClientID + ClientSecret   identifies Freehold as a partner application.
 *                             One pair per licensee, issued by SkySlope after
 *                             an order form is signed — so it lives in env,
 *                             and a self-hosted install needs its own.
 *   AccessKey + Secret        identifies one *agent*. Each agent generates
 *                             their own under My Account → Integrations →
 *                             Generate New Key, which is why these hang off
 *                             Client rather than Organization: a TC works with
 *                             many agents and holds a separate key for each.
 *
 * The two combine to mint a session token for subsequent calls. This module
 * covers custody of the per-agent half only — reading transactions arrives
 * with the sync stage, once the partner credentials and API docs are in hand.
 */

/** Shape stored on Client.skyslopeConfig; secrets envelope-encrypted. */
export interface SkyslopeConfig {
  accessKeyEnc: ReturnType<typeof encryptSecret>;
  secretEnc: ReturnType<typeof encryptSecret>;
  /** Which SkySlope login these belong to, for the TC's own reference. */
  label?: string;
  connectedAt: string;
  /**
   * Set once a live call has actually succeeded with these credentials.
   * Deliberately absent today: with no partner ClientID/Secret and no
   * reachable API docs, claiming "verified" would be a lie the UI repeats.
   */
  verifiedAt?: string;
}

export interface SkyslopeCredentials {
  accessKey: string;
  secret: string;
  label?: string;
}

export function parseSkyslopeConfig(raw: unknown): SkyslopeConfig | null {
  const cfg = raw as SkyslopeConfig | null;
  return cfg?.accessKeyEnc && cfg.secretEnc ? cfg : null;
}

export function encodeSkyslopeConfig(creds: SkyslopeCredentials): SkyslopeConfig {
  const master = loadMasterKey();
  return {
    accessKeyEnc: encryptSecret(creds.accessKey, master),
    secretEnc: encryptSecret(creds.secret, master),
    label: creds.label,
    connectedAt: new Date().toISOString(),
  };
}

/** Decrypt for use. Callers must audit the reveal — these are a third party's keys. */
export function decodeSkyslopeConfig(cfg: SkyslopeConfig): SkyslopeCredentials {
  const master = loadMasterKey();
  return {
    accessKey: decryptSecret(cfg.accessKeyEnc, master),
    secret: decryptSecret(cfg.secretEnc, master),
    label: cfg.label,
  };
}

/**
 * The partner half, from env. Absent on most installs: SkySlope issues these
 * per licensee under a signed agreement, so a self-hoster brings their own and
 * Freehold Cloud brings ours.
 */
export function partnerCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.SKYSLOPE_CLIENT_ID?.trim();
  const clientSecret = process.env.SKYSLOPE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function partnerConfigured(): boolean {
  return partnerCredentials() !== null;
}

/** Never render a stored key in full; the last four are enough to tell keys apart. */
export function maskKey(key: string): string {
  const tail = key.slice(-4);
  return key.length <= 4 ? "••••" : `••••••••${tail}`;
}

export type SkyslopeState =
  /** No partner agreement on this install — the feature can't do anything yet. */
  | "partner-missing"
  /** Partner ready, this client hasn't handed over their key. */
  | "not-connected"
  /** Key stored, but never proven against the live API. */
  | "stored"
  /** A live call has succeeded with it. */
  | "verified";

export function skyslopeState(cfg: SkyslopeConfig | null): SkyslopeState {
  if (!partnerConfigured()) return "partner-missing";
  if (!cfg) return "not-connected";
  return cfg.verifiedAt ? "verified" : "stored";
}
