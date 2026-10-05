/**
 * Next calls this for every error thrown while rendering a page, running a
 * route handler or running a server action. We record it with the page the
 * person was on and who they are, for /admin/errors.
 */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("@/lib/error-log");
  const { auth } = await import("@/lib/auth");
  const e = err as { message?: string; stack?: string; digest?: string; alreadyLogged?: boolean };
  if (e?.alreadyLogged) return;

  const headers = new Headers();
  for (const [k, v] of Object.entries(request.headers)) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(", "));
  }
  const session = await auth.api.getSession({ headers }).catch(() => null);
  const isAction = headers.has("next-action");

  logError({
    source: "server",
    message: e?.message ?? String(err),
    stack: e?.stack,
    digest: e?.digest,
    path: request.path,
    action: isAction ? "Server action" : `${context.routeType} (${request.method})`,
    userId: session?.user.id,
    userEmail: session?.user.email,
    tenantId: session?.session.activeOrganizationId ?? null,
    userAgent: headers.get("user-agent"),
    detail: { routePath: context.routePath, routeType: context.routeType },
  });
}
