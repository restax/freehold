import { prisma } from "@freehold/db";
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

/** The caller's role in the active tenant ("owner" | "admin" | "member"). */
export async function getMemberRole(tenantId: string, userId: string): Promise<string> {
  const member = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId },
    select: { role: true },
  });
  return member?.role ?? "member";
}

/** Role plus assigned compliance tier, for review-authority checks. */
export async function getMemberCompliance(
  tenantId: string,
  userId: string,
): Promise<{ role: string; complianceTier: number | null }> {
  const member = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId },
    select: { role: true, complianceTier: true },
  });
  return { role: member?.role ?? "member", complianceTier: member?.complianceTier ?? null };
}

/**
 * requireTenant plus an admin check. Destructive actions call this and no-op
 * for plain members (owner/admin pass). Button-hiding for members is a UI
 * refinement tracked for later — the enforcement lives here either way.
 */
export async function requireAdminTenant() {
  const ctx = await requireTenant();
  const role = await getMemberRole(ctx.tenantId, ctx.userId);
  return { ...ctx, role, isAdmin: role === "owner" || role === "admin" };
}
