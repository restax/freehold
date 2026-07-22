import { prisma } from "@freehold/db";
import { RESERVED_SLUGS } from "./reserved-slugs";

/**
 * A username doubles as the user's subdomain, so it shares the
 * *.freeholdtc.dev namespace with workspace slugs and reserved subdomains.
 * It must therefore be URL-safe and unique across usernames, workspace slugs,
 * and the reserved list. Format rules live here as pure functions so the live
 * availability endpoint, the signup form, and the server-side signup hook all
 * agree.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

// The reserved subdomains (shared with the host router) plus a few handles we
// never want a person to claim (impersonation / confusion).
const USERNAME_RESERVED = new Set([
  ...RESERVED_SLUGS,
  "admin",
  "root",
  "support",
  "help",
  "billing",
  "security",
  "team",
  "about",
  "freehold",
  "login",
  "signup",
  "dashboard",
]);

/** Lowercase + trim. The stored username is always the normalized form. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * The reason a (normalized) username is not a legal handle, or null if it's a
 * well-formed, non-reserved one. Does not touch the database.
 */
export function usernameFormatError(username: string): string | null {
  if (username.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`;
  if (username.length > USERNAME_MAX) return `At most ${USERNAME_MAX} characters.`;
  if (!/^[a-z0-9-]+$/.test(username)) return "Lowercase letters, numbers, and hyphens only.";
  if (username.startsWith("-") || username.endsWith("-"))
    return "Can't start or end with a hyphen.";
  if (username.includes("--")) return "No double hyphens.";
  if (USERNAME_RESERVED.has(username)) return "That name is reserved.";
  return null;
}

export interface UsernameAvailability {
  available: boolean;
  /** The normalized handle that was checked. */
  username: string;
  /** Present when unavailable: a short, user-facing reason. */
  reason?: string;
}

/**
 * Whether a username may be claimed right now: well-formed, not reserved, and
 * not already taken by another user or by a workspace slug (they share the
 * subdomain namespace). `exceptUserId` lets an existing user re-check their own
 * current handle without colliding with themselves.
 */
export async function checkUsernameAvailability(
  raw: string,
  exceptUserId?: string,
): Promise<UsernameAvailability> {
  const username = normalizeUsername(raw);
  const formatError = usernameFormatError(username);
  if (formatError) return { available: false, username, reason: formatError };

  const [userHit, orgHit] = await Promise.all([
    prisma.user.findFirst({ where: { username }, select: { id: true } }),
    prisma.organization.findFirst({ where: { slug: username }, select: { id: true } }),
  ]);
  if (userHit && userHit.id !== exceptUserId) {
    return { available: false, username, reason: "That username is taken." };
  }
  if (orgHit) return { available: false, username, reason: "That name is taken by a workspace." };
  return { available: true, username };
}
