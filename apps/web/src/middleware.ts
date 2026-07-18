import { type NextRequest, NextResponse } from "next/server";

/**
 * Tenant subdomains: acme.freeholdtc.dev is the client-facing face of the
 * "acme" workspace. Only the portal surface lives there — the bare subdomain
 * shows a branded entry page and /portal/<token> links work unchanged; any
 * other path bounces to the apex, where the app itself lives.
 *
 * The root host comes from BETTER_AUTH_URL, so this works identically for a
 * self-hosted install that points wildcard DNS at itself, and does nothing
 * when requests arrive on the root host.
 */
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "mail", "demo", "status"]);

function rootHost(): string | null {
  const url = process.env.BETTER_AUTH_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const root = rootHost();
  const host = req.headers.get("host");
  if (!root || !host || host === root || !host.endsWith(`.${root}`)) {
    return NextResponse.next();
  }
  const slug = host.slice(0, -(root.length + 1));
  if (!slug || slug.includes(".") || RESERVED_SUBDOMAINS.has(slug)) {
    return NextResponse.next();
  }

  const { pathname, search, protocol } = req.nextUrl;
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = `/t/${slug}`;
    return NextResponse.rewrite(url);
  }
  if (pathname.startsWith("/portal/")) {
    return NextResponse.next();
  }
  return NextResponse.redirect(`${protocol}//${root}${pathname}${search}`, 308);
}

export const config = {
  // Skip static assets and API routes; everything else may need host routing.
  matcher: ["/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)"],
};
