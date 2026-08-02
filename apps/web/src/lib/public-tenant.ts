// Relative for the same reason as in host-routing.ts: value imports through
// the "@/" alias don't resolve under vitest.
import { normalizeHost } from "./host-routing";

/**
 * The [slug] segment of a public /t route is either a workspace slug or a
 * custom domain, and this turns it into a `where` clause.
 *
 * One route tree serves both because middleware rewrites a custom domain to
 * /t/<host>. That works because the two namespaces cannot collide: workspace
 * slugs are `[a-z0-9-]+` (lib/username.ts validates the shared handle/slug
 * namespace), so a dot means hostname and nothing else. Duplicating the /t
 * pages under a parallel /d/[host] tree was the alternative, and two copies of
 * a public page's access rules is exactly the kind of thing that drifts.
 *
 * A custom domain only matches while it is "active". A workspace that has
 * merely typed a domain in — pending, or failed verification — must not serve
 * anything on it, or claiming a hostname you don't own would be enough to sit
 * on it.
 */
export function publicTenantWhere(
  param: string,
): { slug: string } | { customDomain: string; customDomainStatus: string } {
  return param.includes(".")
    ? { customDomain: normalizeHost(param), customDomainStatus: "active" }
    : { slug: param };
}
