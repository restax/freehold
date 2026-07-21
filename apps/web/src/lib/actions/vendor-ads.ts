"use server";

import { prisma } from "@freehold/db";
import {
  adPriceConfigured,
  billingEnabled,
  createAdCheckout,
  createPortalSession,
} from "@freehold/ee-billing";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { optStr, str } from "@/lib/forms";
import { adminAlert } from "@/lib/notify";
import { isOperator } from "@/lib/operator";
import { requireVendor } from "@/lib/vendor-auth";

/**
 * Vendor advertising — a paid, operator-moderated placement. A vendor writes an
 * ad and subscribes; any content change resets it to PENDING so Freehold reviews
 * whatever will carry its name. Placement (the Sponsored slots on the directory
 * and /vendors) reads only ACTIVE ads. Everything here is app-scoped: vendor_ad
 * has no tenant and no RLS, so writes are gated by requireVendor / isOperator.
 */

function baseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

/** Vendor creates or edits their ad, then goes to Stripe Checkout if unpaid. */
export async function createVendorAd(formData: FormData) {
  const { vendorId, email } = await requireVendor();
  const headline = str(formData, "headline").trim();
  const body = str(formData, "body").trim();
  const linkUrl = str(formData, "linkUrl").trim();
  if (!headline || !body || !linkUrl || !/^https?:\/\//.test(linkUrl)) return;

  // One ad per vendor: reuse the row if it exists. Any content edit re-enters
  // moderation (PENDING) so nothing changes what's live without a fresh review.
  const existing = await prisma.vendorAd.findFirst({ where: { vendorId } });
  const ad = existing
    ? await prisma.vendorAd.update({
        where: { id: existing.id },
        data: { headline, body, linkUrl, status: "PENDING", reviewNote: null },
      })
    : await prisma.vendorAd.create({ data: { vendorId, headline, body, linkUrl } });

  if (!billingEnabled() || !adPriceConfigured()) {
    // Self-hosted / unconfigured: no purchase path; the panel explains this.
    revalidatePath("/vendor/profile");
    return;
  }

  // Already paying: keep the subscription, just re-review the new content.
  const paid = ad.stripeSubscriptionId && ad.periodEnd && ad.periodEnd > new Date();
  if (paid) {
    revalidatePath("/vendor/profile");
    return;
  }

  const checkout = await createAdCheckout({
    vendorAdId: ad.id,
    vendorId,
    customerEmail: email,
    existingCustomerId: ad.stripeCustomerId,
    baseUrl: baseUrl(),
  });
  redirect(checkout.url);
}

/** Vendor opens the Stripe customer portal to manage/cancel their ad billing. */
export async function openAdBilling() {
  const { vendorId } = await requireVendor();
  const ad = await prisma.vendorAd.findFirst({
    where: { vendorId },
    select: { stripeCustomerId: true },
  });
  if (!ad?.stripeCustomerId) return;
  const url = await createPortalSession(ad.stripeCustomerId, baseUrl());
  redirect(url);
}

/** Operator approves an ad → it goes live in the Sponsored slots. */
export async function approveAd(formData: FormData) {
  if (!(await isOperator())) return;
  const id = str(formData, "id");
  if (!id) return;
  await prisma.vendorAd.update({
    where: { id },
    data: { status: "ACTIVE", reviewNote: null },
  });
  adminAlert(`✅ Approved vendor ad ${id}`);
  revalidatePath("/admin/ads");
}

/** Operator rejects an ad, with a note the vendor sees. It never shows. */
export async function rejectAd(formData: FormData) {
  if (!(await isOperator())) return;
  const id = str(formData, "id");
  if (!id) return;
  await prisma.vendorAd.update({
    where: { id },
    data: { status: "REJECTED", reviewNote: optStr(formData, "note") },
  });
  revalidatePath("/admin/ads");
}
