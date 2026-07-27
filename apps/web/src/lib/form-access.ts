/**
 * Rules for identified intake: who counts as a known client, and when a
 * magic link is still good.
 *
 * Dependency-free (the billing-cadence pattern) because these are the rules
 * that decide whether an unauthenticated stranger gets treated as one of the
 * workspace's clients — worth testing without the app's module graph.
 */

/** How long an emailed form link stays good. */
export const LINK_TTL_HOURS = 72;

/** Attempts allowed per source, per window, before lookups stop answering. */
export const LOOKUP_LIMIT = 6;
export const LOOKUP_WINDOW_MINUTES = 15;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailish(raw: string): boolean {
  return EMAIL_RE.test(normalizeEmail(raw));
}

export function linkExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + LINK_TTL_HOURS * 60 * 60 * 1000);
}

export interface AccessLinkState {
  expiresAt: Date;
  revokedAt: Date | null;
}

/**
 * A link opens the form only while it is unrevoked and unexpired. Used
 * links stay usable until they expire: a client who submits one transaction
 * and starts another the same week shouldn't have to ask for a new link,
 * and the blast radius either way is a queued submission.
 */
export function linkUsable(link: AccessLinkState, now: Date = new Date()): boolean {
  if (link.revokedAt) return false;
  return link.expiresAt.getTime() > now.getTime();
}

export type LinkRejection = "expired" | "revoked" | null;

export function linkRejection(link: AccessLinkState, now: Date = new Date()): LinkRejection {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt.getTime() <= now.getTime()) return "expired";
  return null;
}

/**
 * What a known client's details fill in on a form, keyed the way
 * MAPPED_FIELDS keys them. Only identity is prefilled — never anything
 * about a deal — so an opened link reveals nothing the recipient's own
 * inbox didn't already establish.
 */
export function prefillFromClient(client: {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}): Record<string, string> {
  const out: Record<string, string> = { clientName: client.name };
  if (client.email) out.email = client.email;
  if (client.phone) out.phone = client.phone;
  if (client.address) out.address = client.address;
  return out;
}
