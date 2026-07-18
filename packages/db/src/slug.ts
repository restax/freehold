/**
 * Derive a URL-safe tenant slug from a business name.
 * "Smith Realty & Co." -> "smith-realty-co"
 */
export function tenantSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
