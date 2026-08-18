import { type NextRequest, NextResponse } from "next/server";
import { routeForHost } from "@/lib/host-routing";
import { hasSessionCookie } from "@/lib/session-cookie";

/**
 * Host-based routing. The rules live in lib/host-routing.ts (pure, unit
 * tested); this file only turns a decision into a Next response.
 *
 * The root host comes from BETTER_AUTH_URL, so this works identically for a
 * self-hosted install pointing wildcard DNS at itself, and does nothing when
 * requests arrive on the root host.
 */
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
  const route = routeForHost(req.headers.get("host"), root, req.nextUrl.pathname);

  switch (route.kind) {
    case "rewrite": {
      const url = req.nextUrl.clone();
      url.pathname = route.pathname;
      return NextResponse.rewrite(url);
    }
    case "redirect-root": {
      const { pathname, search, protocol } = req.nextUrl;
      // `root` is non-null here: routeForHost only returns this when it had one.
      return NextResponse.redirect(`${protocol}//${root}${pathname}${search}`, 308);
    }
    default:
      // The landing page used to call getSession() and redirect itself, which
      // made it render per request and stopped Vercel caching it at all. The
      // decision lives here now so the page can be static for everyone who
      // isn't already signed in — every visitor arriving from a search result.
      if (
        req.nextUrl.pathname === "/" &&
        hasSessionCookie(req.cookies.getAll().map((c) => c.name))
      ) {
        return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
      }
      return NextResponse.next();
  }
}

export const config = {
  // Skip static assets and API routes; everything else may need host routing.
  matcher: ["/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)"],
};
