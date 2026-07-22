import { randomBytes } from "node:crypto";
import { CreditLedgerReason, prisma } from "@freehold/db";

/**
 * Redeemable AI-credit coupons: an operator mints a code worth N credits; a
 * tenant redeems it on the billing page and the credits land on their balance.
 * Platform tables (no RLS) — see the schema. A workspace can redeem a given
 * code only once (CreditCouponRedemption unique), and a code stops working once
 * its maxRedemptions are used.
 */

/** A readable code like CREDIT-7Q4K-2XZP. */
function randomCouponCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L
  const pick = (n: number) =>
    Array.from(randomBytes(n), (b) => alphabet[b % alphabet.length]).join("");
  return `CREDIT-${pick(4)}-${pick(4)}`;
}

export interface CreateCreditCouponInput {
  code?: string | null;
  credits: number;
  expiresAt: Date | null;
  maxRedemptions: number;
  note: string | null;
}

/** Operator: mint a credit coupon. Returns the final code string. */
export async function createCreditCoupon(input: CreateCreditCouponInput): Promise<string> {
  const credits = Math.max(1, Math.floor(input.credits));
  const code = (input.code?.trim().toUpperCase().replace(/\s+/g, "") || randomCouponCode()).slice(
    0,
    40,
  );
  await prisma.creditCoupon.create({
    data: {
      code,
      credits,
      expiresAt: input.expiresAt,
      maxRedemptions: Math.max(1, input.maxRedemptions),
      note: input.note,
    },
  });
  return code;
}

/**
 * The stateless reason a coupon can't be redeemed right now (expired, or fully
 * used), or null if it looks redeemable. Extracted so it's unit-testable and so
 * the redeem path and any UI share one source of truth. Per-tenant "already
 * redeemed" is checked separately, against the redemption rows.
 */
export function couponIssue(
  coupon: { expiresAt: Date | null; timesRedeemed: number; maxRedemptions: number } | null,
  now: number,
): string | null {
  if (!coupon) return "That code isn't valid.";
  if (coupon.expiresAt && coupon.expiresAt.getTime() < now) return "That code has expired.";
  if (coupon.timesRedeemed >= coupon.maxRedemptions) return "That code has been fully redeemed.";
  return null;
}

export interface CreditRedeemResult {
  ok: boolean;
  error?: string;
  /** Credits granted, on success. */
  credits?: number;
  /** New balance, on success. */
  balance?: number;
}

/** Tenant: redeem a credit coupon, adding its credits to the workspace balance. */
export async function redeemCreditCoupon(
  tenantId: string,
  rawCode: string,
): Promise<CreditRedeemResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a code." };
  const coupon = await prisma.creditCoupon.findUnique({ where: { code } });
  const issue = couponIssue(coupon, Date.now());
  if (issue || !coupon) return { ok: false, error: issue ?? "That code isn't valid." };

  const prior = await prisma.creditCouponRedemption.findUnique({
    where: { couponId_tenantId: { couponId: coupon.id, tenantId } },
  });
  if (prior) return { ok: false, error: "You've already redeemed that code." };

  try {
    const balance = await prisma.$transaction(async (tx) => {
      // Conditional bump enforces maxRedemptions even under concurrent redeems:
      // only the redemptions that still fit under the cap succeed.
      const bump = await tx.creditCoupon.updateMany({
        where: { id: coupon.id, timesRedeemed: { lt: coupon.maxRedemptions } },
        data: { timesRedeemed: { increment: 1 } },
      });
      if (bump.count === 0) throw new Error("EXHAUSTED");
      // Unique (couponId, tenantId): a concurrent second redeem by the same
      // tenant hits the constraint and rolls the whole transaction back.
      await tx.creditCouponRedemption.create({ data: { couponId: coupon.id, tenantId } });
      const org = await tx.organization.update({
        where: { id: tenantId },
        data: { aiCredits: { increment: coupon.credits } },
        select: { aiCredits: true },
      });
      await tx.creditLedger.create({
        data: {
          tenantId,
          delta: coupon.credits,
          reason: CreditLedgerReason.COUPON,
          balanceAfter: org.aiCredits,
          note: `coupon:${coupon.code}`,
        },
      });
      return org.aiCredits;
    });
    return { ok: true, credits: coupon.credits, balance };
  } catch {
    // Exhausted or a per-tenant unique collision under a race.
    return { ok: false, error: "That code has already been used." };
  }
}

export interface CreditCouponRow {
  id: string;
  code: string;
  credits: number;
  timesRedeemed: number;
  maxRedemptions: number;
  expiresAt: Date | null;
  note: string | null;
  createdAt: Date;
}

/** Operator: list minted credit coupons, newest first. */
export async function listCreditCoupons(): Promise<CreditCouponRow[]> {
  return prisma.creditCoupon.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      code: true,
      credits: true,
      timesRedeemed: true,
      maxRedemptions: true,
      expiresAt: true,
      note: true,
      createdAt: true,
    },
  });
}
