"use server";

import { prisma } from "@freehold/db";
import {
  billingEnabled,
  createCreditCheckout,
  createPortalSession,
  createUpgradeCheckout,
  creditsEnabled,
} from "@freehold/ee-billing";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { redeemCompCode } from "@/lib/comp";
import { redeemCreditCoupon } from "@/lib/credit-coupons";
import { oneOf, str } from "@/lib/forms";
import { PAYMENTS_PAUSED } from "@/lib/payments-paused";
import { CREDIT_PACK_SIZES } from "@/lib/plans";
import { requireAdminTenant } from "@/lib/tenant";

function baseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

export async function startUpgrade(formData: FormData) {
  if (PAYMENTS_PAUSED) return;
  const { tenantId, session, isAdmin } = await requireAdminTenant();
  if (!isAdmin || !billingEnabled()) return;
  const tier = oneOf(formData, "tier", ["PRO", "BUSINESS"] as const, "PRO");

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  });
  const checkout = await createUpgradeCheckout({
    tenantId,
    tier,
    customerEmail: session.user.email,
    existingCustomerId: org.stripeCustomerId,
    baseUrl: baseUrl(),
  });
  // Cart tracking for the operator analytics panel; never blocks checkout.
  await prisma.checkoutAttempt
    .create({
      data: { id: checkout.sessionId, tenantId, email: session.user.email, tier },
    })
    .catch(() => {});
  redirect(checkout.url);
}

/** Tenant admin: buy a one-time AI credit pack (1, 5, or 10 credits). */
export async function startCreditCheckout(formData: FormData) {
  if (PAYMENTS_PAUSED) return;
  const { tenantId, session, isAdmin } = await requireAdminTenant();
  if (!isAdmin || !billingEnabled() || !creditsEnabled()) return;
  const credits = Number(str(formData, "credits"));
  if (!CREDIT_PACK_SIZES.includes(credits)) return;

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  });
  const checkout = await createCreditCheckout({
    tenantId,
    credits,
    customerEmail: session.user.email,
    existingCustomerId: org.stripeCustomerId,
    baseUrl: baseUrl(),
  });
  redirect(checkout.url);
}

/** Tenant admin: redeem a comp code for a full plan (no Stripe checkout). */
export async function redeemCode(formData: FormData) {
  const { tenantId, session, isAdmin } = await requireAdminTenant();
  if (!isAdmin) {
    redirect(
      `/dashboard/billing?codeError=${encodeURIComponent("Only admins can redeem a code.")}`,
    );
  }
  const result = await redeemCompCode(tenantId, str(formData, "code"));
  if (!result.ok) {
    redirect(`/dashboard/billing?codeError=${encodeURIComponent(result.error ?? "Invalid code.")}`);
  }
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "billing.comp_redeemed",
    summary: `Redeemed a complimentary ${result.tier} plan`,
  });
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/billing?redeemed=${result.tier}`);
}

/** Tenant admin: redeem an AI-credit coupon (adds credits, no charge). */
export async function redeemCreditCode(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) {
    redirect(
      `/dashboard/billing?creditError=${encodeURIComponent("Only admins can redeem a code.")}`,
    );
  }
  const result = await redeemCreditCoupon(tenantId, str(formData, "code"));
  if (!result.ok) {
    redirect(
      `/dashboard/billing?creditError=${encodeURIComponent(result.error ?? "Invalid code.")}`,
    );
  }
  revalidatePath("/dashboard/billing");
  redirect(`/dashboard/billing?creditRedeemed=${result.credits}`);
}

export async function openBillingPortal(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin || !billingEnabled()) return;
  void formData;
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  });
  if (!org.stripeCustomerId) return;
  const url = await createPortalSession(org.stripeCustomerId, baseUrl());
  redirect(url);
}
