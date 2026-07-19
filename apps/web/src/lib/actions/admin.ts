"use server";

import { prisma } from "@freehold/db";
import {
  applyCouponToSubscription,
  billingEnabled,
  createDiscountCoupon,
} from "@freehold/ee-billing";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { optStr, str } from "@/lib/forms";
import { isOperator } from "@/lib/operator";
import { requireTenant } from "@/lib/tenant";

/** Operator: create a discount promotion code ($ off or free, N months). */
export async function adminCreateCoupon(formData: FormData) {
  if (!(await isOperator()) || !billingEnabled()) return;
  const code = str(formData, "code").trim().toUpperCase().replace(/\s+/g, "");
  const months = Math.max(1, Math.min(24, Number(str(formData, "months")) || 1));
  const kind = str(formData, "kind"); // "amount" | "free"
  const amount = Number(optStr(formData, "amount") ?? 0);
  if (!code) return;
  if (kind === "amount" && (!amount || amount <= 0)) return;
  await createDiscountCoupon({
    code,
    months,
    ...(kind === "free" ? { freeMonths: true } : { amountOffUsd: amount }),
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
