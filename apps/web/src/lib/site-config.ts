/**
 * Tenant mini-site settings, stored as organization.siteConfig. The site
 * lives at <slug>.<root host> — promotional page + optional new-client
 * registration that lands straight in the workspace as a lead.
 */
export interface TenantSiteConfig {
  published?: boolean;
  tagline?: string;
  about?: string;
  phone?: string;
  email?: string;
  /** Newline-separated list shown as service bullets. */
  services?: string;
  showRegistration?: boolean;
  /**
   * The page layout from the block designer. `unknown` rather than a block
   * array on purpose: this is whatever JSON the column happens to hold, and
   * typing it as an array would be a promise the database can't keep.
   * siteBlocks() parses it defensively. Keeping it opaque also leaves this a
   * plain settings module with no dependency on lib/site-blocks.ts, which
   * imports *this* file. Absent on a site that has never been arranged, which
   * is what makes the legacy fields above the fallback rather than dead weight.
   */
  blocks?: unknown;
}

export function parseSiteConfig(raw: unknown): TenantSiteConfig {
  return raw && typeof raw === "object" ? (raw as TenantSiteConfig) : {};
}

/** https://<slug>.<root host> — mirrors the middleware's host logic. */
export function tenantSiteUrl(slug: string): string {
  const root = process.env.BETTER_AUTH_URL ?? "http://localhost:3010";
  try {
    const u = new URL(root);
    return `${u.protocol}//${slug}.${u.host}`;
  } catch {
    return `https://${slug}.freeholdtc.dev`;
  }
}
