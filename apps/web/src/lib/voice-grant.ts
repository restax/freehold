import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Capability grants for the voice agent.
 *
 * The agent runs as a separate process (LiveKit worker) and is NOT trusted to
 * name its own scope — if it could, a bug or a compromise there would read any
 * tenant's data. Instead the web app mints a short-lived HMAC-signed grant
 * describing exactly what this one conversation may read, hands it to the
 * agent through the LiveKit room metadata, and the agent relays it back on
 * every data request. The app re-verifies the signature and derives the scope
 * from the grant alone — never from anything the agent says.
 *
 * Same shape as the webhook signatures elsewhere in the codebase: HMAC-SHA256,
 * constant-time compare, hard expiry.
 */

/** How long a grant stays valid — a voice conversation, not a session. */
const TTL_MS = 30 * 60 * 1000;

export type VoiceScope =
  /** Signed-in dashboard user: the whole workspace, tenant-scoped. */
  | { kind: "tenant"; tenantId: string; userId: string }
  /** Guest (outside coverage): only the files they're assigned. */
  | { kind: "guest"; tenantId: string; userId: string }
  /** Portal visitor: whatever that capability token already shows them. */
  | { kind: "portal"; portalToken: string }
  /**
   * Anonymous visitor on the marketing site. Reaches no customer data at all —
   * it answers about Freehold itself, from a fixed brief. Deliberately carries
   * no tenant or token, so there is nothing for it to widen into.
   */
  | { kind: "marketing" };

interface GrantBody {
  scope: VoiceScope;
  exp: number;
}

function secret(): string | null {
  // Reuses the auth secret rather than inventing another one to store and
  // rotate; it is already required, already secret, and never leaves the server.
  return process.env.BETTER_AUTH_SECRET ?? null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** Mint a grant string safe to hand to the agent. Null when unconfigured. */
export function mintVoiceGrant(scope: VoiceScope): string | null {
  const key = secret();
  if (!key) return null;
  const body: GrantBody = { scope, exp: Date.now() + TTL_MS };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

/**
 * Verify a grant and return its scope, or null if it's forged, tampered with,
 * or expired. Callers must treat null as "no access at all" — never fall back
 * to a default tenant.
 */
export function verifyVoiceGrant(grant: string | null | undefined): VoiceScope | null {
  const key = secret();
  if (!key || !grant) return null;
  const [payload, signature] = grant.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload, key);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString()) as GrantBody;
    if (typeof body.exp !== "number" || body.exp < Date.now()) return null;
    return body.scope;
  } catch {
    return null;
  }
}
