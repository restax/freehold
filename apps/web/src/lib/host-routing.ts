// Relative rather than "@/lib/...": there is no vitest config in this repo, so
// the path alias only survives in type-only imports. A value import through it
// resolves in Next but not under test.
import { RESERVED_SLUGS } from "./reserved-slugs";

/**
 * Which page a request should get, decided from its Host header alone.
 *
 * Pulled out of middleware.ts so the rules are unit-testable: this is the one
 * piece of the app that decides what a stranger typing a hostname sees, and it
 * used to be untested branching inside an edge function.
 *
 * Three kinds of host arrive:
 *
 * - **The root host** (freeholdtc.dev) — the app itself. Untouched.
 * - **A subdomain** (acme.freeholdtc.dev) — a workspace's public face.
 * - **Anything else** — a custom domain the workspace pointed at us. It gets
 *   exactly the surface a subdomain gets, which is why both branches end in
 *   the same `tenantRoute()` call rather than two parallel rule sets that
 *   could drift.
 *
 * No database access, deliberately: this runs in middleware on every request.
 * A custom domain is rewritten to /t/<host>, and the *page* resolves the
 * workspace — see lib/public-tenant.ts for how a host and a slug share one
 * route.
 */

export type HostRoute =
  /** Not host-routed; serve the path as-is. */
  | { kind: "next" }
  /** Serve a different path, keeping the browser's URL. */
  | { kind: "rewrite"; pathname: string }
  /** Send them to the same path on the root host. */
  | { kind: "redirect-root" };

const NEXT: HostRoute = { kind: "next" };

/**
 * Hosts that are ours but are not the configured root — preview deployments,
 * and localhost under any port. Without this a preview build served from
 * freehold-abc123.vercel.app would look like an unknown custom domain and
 * every page on it would 404.
 */
function isPlatformHost(host: string): boolean {
  return (
    host.endsWith(".vercel.app") ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "[::1]"
  );
}

/** Lowercased, port removed — what the Host header means, not how it's written. */
export function normalizeHost(host: string): string {
  const bare = host.trim().toLowerCase();
  // IPv6 literals are bracketed ("[::1]:3000"), so only strip a port when the
  // colon isn't part of the address itself.
  if (bare.startsWith("[")) {
    const close = bare.indexOf("]");
    return close === -1 ? bare : bare.slice(0, close + 1);
  }
  const colon = bare.lastIndexOf(":");
  return colon === -1 ? bare : bare.slice(0, colon);
}

/** A hostname, and nothing that could reshape the path we rewrite to. */
function isWellFormedHost(host: string): boolean {
  return /^[a-z0-9.[\]:-]+$/.test(host) && !host.includes("..");
}

/**
 * The public surface a workspace gets, whether it's reached by subdomain or by
 * its own domain. `param` is what lands in the [slug] segment: a real slug for
 * a subdomain, a hostname for a custom domain. Slugs are `[a-z0-9-]+`, so the
 * dot in a hostname is what tells the two apart downstream.
 */
function tenantRoute(param: string, pathname: string): HostRoute {
  if (pathname === "/") return { kind: "rewrite", pathname: `/t/${param}` };
  // Public intake forms belong on the workspace's own face: acme.<root>/f/<form>
  // serves what /t/acme/f/<form> serves. /fl/<token> is the emailed link to one.
  if (pathname.startsWith("/f/") || pathname.startsWith("/fl/")) {
    return { kind: "rewrite", pathname: `/t/${param}${pathname}` };
  }
  // Portal and review links carry a token that resolves the workspace on its
  // own, so they pass through unchanged — keeping the branded URL that was
  // actually emailed rather than bouncing to the apex.
  if (pathname.startsWith("/portal/") || pathname.startsWith("/r/")) return NEXT;
  return { kind: "redirect-root" };
}

export function routeForHost(
  hostHeader: string | null,
  rootHostHeader: string | null,
  pathname: string,
): HostRoute {
  if (!hostHeader || !rootHostHeader) return NEXT;
  const host = normalizeHost(hostHeader);
  const root = normalizeHost(rootHostHeader);
  if (!host || !isWellFormedHost(host)) return NEXT;
  if (host === root) return NEXT;

  if (host.endsWith(`.${root}`)) {
    const slug = host.slice(0, -(root.length + 1));

    // vendor.<root> is the FreeholdVendors site, not a workspace. It is a
    // reserved slug too, so no workspace can ever take the subdomain.
    if (slug === "vendor") {
      if (pathname.startsWith("/vendor/")) return NEXT;
      // Public vendor pages are canonical on the apex, so a /v/ link from the
      // vendor site goes there rather than 404ing under the /vendor/* rewrite.
      if (pathname.startsWith("/v/")) return { kind: "redirect-root" };
      return {
        kind: "rewrite",
        pathname: pathname === "/" ? "/vendor/dashboard" : `/vendor${pathname}`,
      };
    }

    if (!slug || slug.includes(".") || RESERVED_SLUGS.has(slug)) return NEXT;
    return tenantRoute(slug, pathname);
  }

  // Our own infrastructure under a different name — never a customer's domain.
  if (isPlatformHost(host)) return NEXT;

  return tenantRoute(host, pathname);
}

/**
 * Whether a request arrived on the workspace's own public face rather than at
 * the apex. Decides whether links can be root-relative (/f/intake) or need the
 * /t/<slug> prefix, and where a submitted lead form returns to.
 */
export function onTenantHost(
  hostHeader: string | null,
  slug: string,
  customDomain: string | null | undefined,
): boolean {
  if (!hostHeader) return false;
  const host = normalizeHost(hostHeader);
  if (customDomain && host === normalizeHost(customDomain)) return true;
  return host.startsWith(`${slug}.`);
}
