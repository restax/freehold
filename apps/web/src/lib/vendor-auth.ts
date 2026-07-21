import { prisma } from "@freehold/db";
import { redirect } from "next/navigation";
import { getSession } from "./session";

/**
 * The guard for everything under /vendor.
 *
 * A vendor is a signed-in User who belongs to a Vendor (through VendorUser) —
 * NOT to any Organization. This is the mirror of requireTenant, and the two
 * must never cross: a TC user must not reach a vendor surface, and a vendor
 * user must not reach a workspace. That boundary is the single most
 * security-sensitive line in FreeholdVendors — getting it wrong exposes a
 * whole workspace — so both directions are unit-tested against the pure
 * predicate below.
 */

/** A user's vendor id, or null if they don't act for any vendor. */
export async function vendorIdForUser(userId: string): Promise<string | null> {
  const link = await prisma.vendorUser.findFirst({
    where: { userId },
    select: { vendorId: true },
  });
  return link?.vendorId ?? null;
}

export interface VendorContext {
  userId: string;
  email: string;
  vendorId: string;
}

/**
 * Require a signed-in vendor. No session → vendor login. Signed in but not a
 * vendor → vendor register (they have an account but no vendor yet). Callers
 * get a vendorId proven from the database, never from the request.
 */
export async function requireVendor(): Promise<VendorContext> {
  const session = await getSession();
  if (!session) redirect("/vendor/login");
  const vendorId = await vendorIdForUser(session.user.id);
  if (!vendorId) redirect("/vendor/register");
  return { userId: session.user.id, email: session.user.email, vendorId };
}

/** Whether a user may act for a given vendor — every vendor-scoped write checks this. */
export async function userActsForVendor(userId: string, vendorId: string): Promise<boolean> {
  const link = await prisma.vendorUser.findUnique({
    where: { vendorId_userId: { vendorId, userId } },
    select: { id: true },
  });
  return link !== null;
}
