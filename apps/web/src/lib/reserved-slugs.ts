/**
 * Subdomains the app owns, so no workspace slug may claim them. `vendor` is the
 * FreeholdVendors site; the rest are infra. Shared by the host router
 * (middleware.ts) and workspace creation (onboarding) so the two never drift.
 *
 * Security note: the middleware matches these before any tenant-portal rewrite,
 * so even if a slug slipped through it could not hijack the subdomain. This
 * list is the belt to that suspenders — it keeps a workspace out of a confusing
 * unreachable-subdomain state.
 */
export const RESERVED_SLUGS = new Set(["www", "app", "api", "mail", "demo", "status", "vendor"]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
