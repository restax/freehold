/**
 * Whether a request carries a Better Auth session cookie.
 *
 * Deliberately a *presence* check, not a validation: this runs in middleware,
 * where verifying a session would mean a database round trip on every request
 * to the marketing site. It exists so the landing page can stop calling
 * getSession() itself — that call read headers, which forced the whole page to
 * render per request and made it uncacheable at the CDN. The page a stranger
 * (and Googlebot) sees is now static; deciding that a *signed-in* visitor
 * belongs on the dashboard instead is a cheap cookie check out here.
 *
 * A stale or forged cookie costs one extra hop: /dashboard re-derives the
 * session properly and bounces an unauthenticated visitor to /login.
 *
 * Better Auth names the cookie `<prefix>.session_token` and prepends
 * `__Secure-` when it sets it over HTTPS, so both spellings have to match —
 * and matching on the suffix keeps working if a self-hosted install sets its
 * own `cookiePrefix`.
 */
export function hasSessionCookie(cookieNames: readonly string[]): boolean {
  return cookieNames.some((name) => name.endsWith("session_token"));
}
