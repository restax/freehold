"use server";

import { prisma, type VendorCategory, withTenant } from "@freehold/db";
import { auth } from "@/lib/auth";
import { oneOf, optStr, str } from "@/lib/forms";
import { adminAlert } from "@/lib/notify";
import { requireVendor } from "@/lib/vendor-auth";
import { vendorSlugify } from "@/lib/vendor-profile";

/**
 * Resolve a base slug to one no other vendor holds, appending -2, -3, … on
 * collision. `exclude` keeps a vendor's own current slug from counting as a
 * clash when they re-save. The slug names the public page (/v/<slug>); it is
 * cosmetic, never an authorization token.
 */
async function uniqueVendorSlug(base: string, exclude?: string): Promise<string> {
  let candidate = base;
  for (let n = 2; n < 1000; n++) {
    const clash = await prisma.vendor.findFirst({
      where: { slug: candidate, ...(exclude ? { id: { not: exclude } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${n}`;
  }
  // Astronomically unlikely; fall back to a value that cannot collide.
  return `${base}-${Date.now()}`;
}

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
      slug: await uniqueVendorSlug(vendorSlugify(businessName)),
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

/**
 * Update the signed-in vendor's profile. The fields fall into three visibility
 * tiers, and the form groups them the same way so a vendor always knows who
 * sees what:
 *   - Public — shown on the public page, directory listing, and ads:
 *     publicBio, publicPhone, publicEmail (falls back to the legacy blurb/phone).
 *   - Client-facing — shown to a coordinator's client on an order they place:
 *     clientBio, clientPhone, clientServiceNotes.
 *   - Private — never displayed anywhere: privateEmail (an internal contact).
 * A slug is backfilled the first time an older vendor saves.
 */
export async function updateVendorProfile(formData: FormData) {
  const { vendorId } = await requireVendor();
  const name = str(formData, "name");
  if (!name) return;

  const existing = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { slug: true },
  });

  // The public tier is canonical; the legacy phone/blurb columns mirror it so
  // older surfaces (directory, ad renderer) keep working without a data migration.
  const publicPhone = optStr(formData, "publicPhone");
  const publicBio = optStr(formData, "publicBio");

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      name,
      category: oneOf(formData, "category", CATEGORIES, "OTHER") as VendorCategory,
      phone: publicPhone,
      serviceArea: optStr(formData, "serviceArea"),
      blurb: publicBio,
      listed: str(formData, "listed") === "1",
      // Public tier
      publicBio,
      publicPhone,
      publicEmail: optStr(formData, "publicEmail"),
      // Client-facing tier
      clientBio: optStr(formData, "clientBio"),
      clientPhone: optStr(formData, "clientPhone"),
      clientServiceNotes: optStr(formData, "clientServiceNotes"),
      // Private tier
      privateEmail: optStr(formData, "privateEmail"),
      // Backfill a public-page slug for vendors created before slugs existed.
      ...(existing?.slug ? {} : { slug: await uniqueVendorSlug(vendorSlugify(name)) }),
    },
  });
}
