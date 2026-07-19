"use server";

import { prisma } from "@freehold/db";
import { billingEnabled, createPortalSession, createUpgradeCheckout } from "@freehold/ee-billing";
import { redirect } from "next/navigation";
import { oneOf } from "@/lib/forms";
import { PAYMENTS_PAUSED } from "@/lib/payments-paused";
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
