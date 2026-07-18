"use server";

import { prisma } from "@freehold/db";
import { billingEnabled, createPortalSession, createUpgradeCheckout } from "@freehold/ee-billing";
import { redirect } from "next/navigation";
import { intOr, oneOf, str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";

function baseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

export async function startUpgrade(formData: FormData) {
  const { tenantId, session, isAdmin } = await requireAdminTenant();
  if (!isAdmin || !billingEnabled()) return;
  const tier = oneOf(formData, "tier", ["PRO", "BUSINESS"] as const, "PRO");
  const seats = Math.min(Math.max(intOr(formData, "seats", 2) ?? 2, 1), 100);

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  });
  const url = await createUpgradeCheckout({
    tenantId,
    tier,
    seats,
    customerEmail: session.user.email,
    existingCustomerId: org.stripeCustomerId,
    baseUrl: baseUrl(),
  });
  redirect(url);
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
