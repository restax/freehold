/**
 * Single source of truth for the terms-of-service version stamped onto
 * User.termsAcceptedAt/termsVersion at signup (see the user.create hook in
 * auth.ts). Bump both constants together whenever /terms changes in any way
 * that matters legally, so the stamped version always matches what a given
 * user actually agreed to.
 */
export const TERMS_VERSION = "2026-08-03";
export const TERMS_LAST_UPDATED = "August 3, 2026";
