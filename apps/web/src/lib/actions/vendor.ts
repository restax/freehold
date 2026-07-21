"use server";

import { prisma, type VendorCategory } from "@freehold/db";
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

  adminAlert(`🧰 New vendor registered: ${businessName} (${category}) <${email}>`);
  return { ok: true };
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
