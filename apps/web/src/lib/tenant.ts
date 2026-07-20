import { prisma, withTenant } from "@freehold/db";
import { redirect } from "next/navigation";
import { getSession, listTenants } from "./session";

/** Outside coverage staff: see only the files they're assigned, nothing else. */
export const GUEST_ROLE = "guest";

/**
 * Server-side guard for anything under /dashboard: requires a session and a
 * workspace, and resolves which tenant the request operates on (the session's
 * active organization, else the user's first).
 *
 * **Guests are refused by default.** A guest is somebody from another
 * workspace covering specific files under an engagement; the handful of pages
 * they legitimately need pass `allowGuest` and scope their own queries to the
 * transactions that guest is assigned to. Anything that forgets to think about
 * guests therefore keeps them out, which is the safe direction to fail.
 */
export async function requireTenant(opts: { allowGuest?: boolean } = {}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const tenants = await listTenants();
  const first = tenants[0];
  if (!first) redirect("/onboarding");
  const tenantId =
    tenants.find((t) => t.id === session.session.activeOrganizationId)?.id ?? first.id;

  const isGuest = (await getMemberRole(tenantId, session.user.id)) === GUEST_ROLE;
  if (isGuest && !opts.allowGuest) redirect("/dashboard");

  return { session, tenantId, userId: session.user.id, isGuest };
}

/** The caller's role in the active tenant ("owner" | "admin" | "member" | "guest"). */
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

/**
 * Whether a guest may touch this transaction: only if they're assigned to it.
 * Everyone else in the workspace is unrestricted, so this returns true for
 * them. Read paths 404 on false; write paths no-op.
 */
export async function guestMaySeeTransaction(
  tenantId: string,
  userId: string,
  transactionId: string,
): Promise<boolean> {
  if ((await getMemberRole(tenantId, userId)) !== GUEST_ROLE) return true;
  // transaction_assignee has row-level security forced, so this read has to
  // run inside withTenant — an unscoped query returns nothing and would lock
  // the guest out of the very file they were handed.
  const assigned = await withTenant(tenantId, (tx) =>
    tx.transactionAssignee.findFirst({
      where: { tenantId, userId, transactionId },
      select: { id: true },
    }),
  );
  return assigned !== null;
}
