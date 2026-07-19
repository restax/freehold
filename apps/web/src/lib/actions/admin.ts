"use server";

import { type PlanTier, prisma } from "@freehold/db";
import {
  applyCouponToSubscription,
  billingEnabled,
  createDiscountCoupon,
} from "@freehold/ee-billing";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { createCompCode, grantComp, revokeComp } from "@/lib/comp";
import { dateOnly, optStr, str } from "@/lib/forms";
import { isOperator } from "@/lib/operator";
import { requireTenant } from "@/lib/tenant";

/** Operator: create a discount promotion code ($ off or free, N months). */
export async function adminCreateCoupon(formData: FormData) {
  if (!(await isOperator()) || !billingEnabled()) return;
  const code = str(formData, "code").trim().toUpperCase().replace(/\s+/g, "");
  const months = Math.max(1, Math.min(24, Number(str(formData, "months")) || 1));
  const kind = str(formData, "kind"); // "amount" | "free"
  const amount = Number(optStr(formData, "amount") ?? 0);
  // Optional redemption deadline: end of that day, in Unix seconds for Stripe.
  const expires = dateOnly(formData, "expiresAt");
  const expiresAt = expires
    ? Math.floor((expires.getTime() + 24 * 3600 * 1000 - 1000) / 1000)
    : undefined;
  if (!code) return;
  if (kind === "amount" && (!amount || amount <= 0)) return;
  await createDiscountCoupon({
    code,
    months,
    ...(expiresAt ? { expiresAt } : {}),
    ...(kind === "free" ? { freeMonths: true } : { amountOffUsd: amount }),
  });
  revalidatePath("/admin");
}

function tierParam(formData: FormData): PlanTier {
  return str(formData, "tier") === "BUSINESS" ? "BUSINESS" : "PRO";
}

/** Operator: mint a redeemable comp code (full plan, no Stripe checkout). */
export async function adminCreateCompCode(formData: FormData) {
  if (!(await isOperator())) return;
  const durMonths = Number(optStr(formData, "durationMonths") ?? "");
  const maxRed = Number(optStr(formData, "maxRedemptions") ?? "1");
  await createCompCode({
    code: optStr(formData, "code"),
    tier: tierParam(formData),
    durationMonths: Number.isFinite(durMonths) && durMonths > 0 ? durMonths : null,
    expiresAt: dateOnly(formData, "expiresAt"),
    maxRedemptions: Number.isFinite(maxRed) && maxRed > 0 ? maxRed : 1,
    note: optStr(formData, "note"),
  });
  revalidatePath("/admin");
}

/** Operator: comp a specific workspace directly (no code). */
export async function adminGrantComp(formData: FormData) {
  if (!(await isOperator())) return;
  const tenantId = str(formData, "tenantId");
  if (!tenantId) return;
  const months = Number(optStr(formData, "durationMonths") ?? "");
  await grantComp(tenantId, tierParam(formData), months > 0 ? months : null);
  const { session } = await requireTenant();
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "admin.comp_granted",
    summary: `Operator comped ${tenantId} to ${tierParam(formData)}${months > 0 ? ` for ${months} months` : ""}`,
  });
  revalidatePath("/admin");
}

/** Operator: revoke a comp grant. */
export async function adminRevokeComp(formData: FormData) {
  if (!(await isOperator())) return;
  const tenantId = str(formData, "tenantId");
  if (!tenantId) return;
  await revokeComp(tenantId);
  revalidatePath("/admin");
}

/** Operator: manually clear a nonpayment lock (e.g. after forgiving in Stripe). */
export async function adminUnlockWorkspace(formData: FormData) {
  if (!(await isOperator())) return;
  const tenantId = str(formData, "tenantId");
  if (!tenantId) return;
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  await prisma.organization.update({
    where: { id: tenantId },
    data: { billingSuspendedAt: null },
  });
  const { session } = await requireTenant();
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "admin.workspace_unlocked",
    summary: `Operator cleared the payment lock on ${org?.name ?? tenantId}`,
  });
  revalidatePath("/admin");
}

/** Operator: apply a promotion code to a workspace's active subscription. */
export async function adminApplyCoupon(formData: FormData) {
  if (!(await isOperator()) || !billingEnabled()) return;
  const tenantId = str(formData, "tenantId");
  const code = str(formData, "code").trim().toUpperCase();
  if (!tenantId || !code) return;
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { stripeSubscriptionId: true, name: true },
  });
  if (!org?.stripeSubscriptionId) return;
  await applyCouponToSubscription(org.stripeSubscriptionId, code);
  const { session } = await requireTenant();
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "admin.coupon_applied",
    summary: `Operator applied coupon ${code} to ${org.name}'s subscription (future months)`,
  });
  revalidatePath("/admin");
}
