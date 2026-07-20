/**
 * License expiry semantics, shared by every surface that shows or checks a
 * license. "Licenses" throughout — "credential" is the Vault's word.
 */

export type LicenseHealth = "ok" | "expiring" | "expired";

/** Days of runway below which a license counts as "expiring". */
export const EXPIRY_WARN_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Health of one license. Dates are @db.Date (UTC midnight); a license is good
 * through its expiry date and expired the day after. No expiry on record = ok.
 */
export function licenseHealth(expiresAt: Date | null, now: Date = new Date()): LicenseHealth {
  if (!expiresAt) return "ok";
  const endOfDay = expiresAt.getTime() + DAY_MS;
  if (now.getTime() >= endOfDay) return "expired";
  if (now.getTime() >= endOfDay - EXPIRY_WARN_DAYS * DAY_MS) return "expiring";
  return "ok";
}

/** An unexpired license (ok or expiring) still satisfies a licensed-state check. */
export function licenseValid(expiresAt: Date | null, now: Date = new Date()): boolean {
  return licenseHealth(expiresAt, now) !== "expired";
}

/** Two-letter state code from form input, or null if it isn't one. */
export function normalizeState(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

export const HEALTH_LABEL: Record<LicenseHealth, string> = {
  ok: "Current",
  expiring: "Expiring soon",
  expired: "Expired",
};
