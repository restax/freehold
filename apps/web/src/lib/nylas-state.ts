import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The `state` carried through the Nylas OAuth round trip.
 *
 * The callback is a public URL — anyone can hit it with any query string. The
 * only thing tying a returning `code` to a person is this value, so it can't
 * just be the user id: that would let someone attach their own mailbox to
 * another user's account by editing one parameter. It's signed with the app
 * secret and timestamped, so the callback can prove the flow it's completing
 * is one this server actually started, for that user, recently.
 *
 * Split out from lib/nylas.ts because that module is the Nylas wire protocol
 * and this is our own; the pure functions here are unit-tested without
 * touching the network.
 */

const MAX_AGE_MS = 15 * 60 * 1000;

function secret(): string {
  // Reuses the auth secret rather than adding another required env var —
  // same trust boundary, and it's already required for the app to boot.
  return process.env.BETTER_AUTH_SECRET ?? "";
}

function mac(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function signNylasState(userId: string): string {
  const body = `${userId}.${Date.now()}`;
  return `${Buffer.from(body).toString("base64url")}.${mac(body)}`;
}

/** The user id this state was issued for, or null if it doesn't verify. */
export function verifyNylasState(state: string | null): string | null {
  if (!state || !secret()) return null;
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = state.slice(0, dot);
  const sig = state.slice(dot + 1);

  let body: string;
  try {
    body = Buffer.from(encoded, "base64url").toString();
  } catch {
    return null;
  }

  const expected = Buffer.from(mac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const sep = body.lastIndexOf(".");
  if (sep <= 0) return null;
  const userId = body.slice(0, sep);
  const issued = Number(body.slice(sep + 1));
  if (!Number.isFinite(issued) || Date.now() - issued > MAX_AGE_MS) return null;
  return userId || null;
}

/**
 * The callback URL, derived from the incoming request so local development
 * and production each get their own. Must match a Callback URI registered in
 * the Nylas dashboard exactly, and must be identical on the auth request and
 * the token exchange or Nylas rejects the code.
 */
export function nylasCallbackUri(requestUrl: string): string {
  return new URL("/api/nylas/callback", requestUrl).toString();
}
