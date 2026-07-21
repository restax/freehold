"use server";

import { prisma, type VendorCategory, withTenant } from "@freehold/db";
import { auth } from "@/lib/auth";
import { oneOf, optStr, str } from "@/lib/forms";
import { adminAlert } from "@/lib/notify";
import { requireVendor } from "@/lib/vendor-auth";

/**
 * Vendor account lifecycle. A vendor is a User with a VendorUser link and no
 * Organization — see lib/vendor-auth.ts for why the two never cross.
 *
 * Self-registration marks the account verified rather than running the OTP
 * dance (same as demo accounts): a vendor is expected, and the real trust gate
 * is the per-connection accept a TC performs before any order flows. Email
 * verification can be layered on later without changing this shape.
 *
 * This action only creates the account and vendor; the browser then signs in
 * with authClient (which sets the session cookie reliably), the same split the
 * TC signup flow uses. Establishing the session from inside a server action is
 * doable but brittle with better-auth's cookie shapes — not worth the risk on
 * the one path that mints an identity.
 */

const CATEGORIES = ["TITLE", "INSPECTION", "PHOTOGRAPHY", "SIGNAGE", "LEGAL", "OTHER"] as const;

export type VendorRegisterResult = { ok: true } | { ok: false; error: string };

export async function registerVendor(formData: FormData): Promise<VendorRegisterResult> {
  const personName = str(formData, "personName");
  const businessName = str(formData, "businessName");
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const category = oneOf<(typeof CATEGORIES)[number]>(formData, "category", CATEGORIES, "OTHER");
  if (!personName || !businessName || !email || password.length < 8) {
    return { ok: false, error: "Fill every field; password must be at least 8 characters." };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return {
      ok: false,
      error: "An account already exists for that email. Sign in instead.",
    };
  }
  if (await prisma.vendor.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, error: "A vendor is already registered with that email." };
  }

  await auth.api.signUpEmail({ body: { email, password, name: personName } });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: false, error: "Could not create the account. Try again." };
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });

  const vendor = await prisma.vendor.create({
    data: {
      name: businessName,
      email,
      category: category as VendorCategory,
      phone: optStr(formData, "phone"),
      serviceArea: optStr(formData, "serviceArea"),
    },
  });
  await prisma.vendorUser.create({ data: { vendorId: vendor.id, userId: user.id, role: "owner" } });

  const claimed = await claimEmailedOrders(email, vendor.id);

  adminAlert(
    `🧰 New vendor registered: ${businessName} (${category}) <${email}>` +
      (claimed > 0 ? ` — claimed ${claimed} order(s) emailed before signup` : ""),
  );
  return { ok: true };
}

/**
 * The upgrade path: orders emailed to this address before the vendor had an
 * account now attach to their new Vendor. Those orders live in other tenants'
 * RLS-protected tables, and a just-registered vendor has no tenant context —
 * so we find them through vendor_order_link (a no-RLS capability table that
 * carries the tenant), then update each order tenant-scoped. Claiming an order
 * also opens an ACTIVE connection: the coordinator already reached out by
 * ordering, so future orders can flow the easy way.
 */
async function claimEmailedOrders(email: string, vendorId: string): Promise<number> {
  const links = await prisma.vendorOrderLink.findMany({
    where: { email },
    select: { tenantId: true, orderId: true },
  });
  let claimed = 0;
  for (const link of links) {
    const didClaim = await withTenant(link.tenantId, async (tx) => {
      const order = await tx.vendorOrder.findUnique({
        where: { id: link.orderId },
        select: { id: true, vendorId: true },
      });
      if (!order || order.vendorId) return false;
      await tx.vendorOrder.update({ where: { id: order.id }, data: { vendorId } });
      // Denormalized vendor_id on the history lets the vendor read the trail
      // through withVendor (the two-sided RLS keys off it).
      await tx.vendorOrderEvent.updateMany({ where: { orderId: order.id }, data: { vendorId } });
      return true;
    });
    if (!didClaim) continue;
    claimed += 1;
    await withTenant(link.tenantId, (tx) =>
      tx.vendorConnection.upsert({
        where: { tenantId_vendorId: { tenantId: link.tenantId, vendorId } },
        create: {
          tenantId: link.tenantId,
          vendorId,
          status: "ACTIVE",
          requestedBy: "TENANT",
          respondedAt: new Date(),
        },
        update: {},
      }),
    );
  }
  return claimed;
}

/** Update the signed-in vendor's public profile. */
export async function updateVendorProfile(formData: FormData) {
  const { vendorId } = await requireVendor();
  const name = str(formData, "name");
  if (!name) return;
  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      name,
      category: oneOf(formData, "category", CATEGORIES, "OTHER") as VendorCategory,
      phone: optStr(formData, "phone"),
      serviceArea: optStr(formData, "serviceArea"),
      blurb: optStr(formData, "blurb"),
      listed: str(formData, "listed") === "1",
    },
  });
}
