import { redirect } from "next/navigation";
import { getSession, listTenants } from "./session";

/**
 * Server-side guard for anything under /dashboard: requires a session and a
 * workspace, and resolves which tenant the request operates on (the session's
 * active organization, else the user's first).
 */
export async function requireTenant() {
  const session = await getSession();
  if (!session) redirect("/login");
  const tenants = await listTenants();
  const first = tenants[0];
  if (!first) redirect("/onboarding");
  const tenantId =
    tenants.find((t) => t.id === session.session.activeOrganizationId)?.id ?? first.id;
  return { session, tenantId, userId: session.user.id };
}
