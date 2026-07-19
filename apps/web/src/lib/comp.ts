import { randomBytes } from "node:crypto";
import { type PlanTier, prisma } from "@freehold/db";
import { PLAN_INFO } from "@/lib/plans";

/**
 * Complimentary ("comped") plans: a full paid plan granted with no Stripe
 * checkout and no charge. Operators mint redeemable codes; a tenant redeems
 * one on the billing page. Redemption sets org.compTier + compExpiresAt, which
 * override planTier in getTenantPlan. Comped workspaces have no Stripe
 * subscription, so billing webhooks never touch them.
 */

const CODE_TIERS: PlanTier[] = ["PRO", "BUSINESS"];

/** A readable code like COMP-7Q4K-2XZP. */
function randomCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L
  const pick = (n: number) =>
    Array.from(randomBytes(n), (b) => alphabet[b % alphabet.length]).join("");
  return `COMP-${pick(4)}-${pick(4)}`;
}

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Whether an org's comp grant is currently in force. */
export function compActive(compTier: PlanTier | null, compExpiresAt: Date | null): boolean {
  return compTier != null && (compExpiresAt == null || compExpiresAt.getTime() > Date.now());
}

export interface CreateCompCodeInput {
  code?: string | null;
  tier: PlanTier;
  durationMonths: number | null;
  expiresAt: Date | null;
  maxRedemptions: number;
  note: string | null;
}

/** Operator: mint a comp code. Returns the final code string. */
export async function createCompCode(input: CreateCompCodeInput): Promise<string> {
  const tier = CODE_TIERS.includes(input.tier) ? input.tier : "PRO";
  const code = (input.code?.trim().toUpperCase().replace(/\s+/g, "") || randomCode()).slice(0, 40);
  await prisma.compCode.create({
    data: {
      code,
      tier,
      durationMonths: input.durationMonths,
      expiresAt: input.expiresAt,
      maxRedemptions: Math.max(1, input.maxRedemptions),
      note: input.note,
    },
  });
  return code;
}

export interface RedeemResult {
  ok: boolean;
  error?: string;
  tier?: PlanTier;
}

/** Tenant: redeem a comp code, granting the plan with no Stripe involvement. */
export async function redeemCompCode(tenantId: string, rawCode: string): Promise<RedeemResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a code." };
  const cc = await prisma.compCode.findUnique({ where: { code } });
  if (!cc) return { ok: false, error: "That code isn't valid." };
  if (cc.expiresAt && cc.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "That code has expired." };
  }
  if (cc.timesRedeemed >= cc.maxRedemptions) {
    return { ok: false, error: "That code has already been used." };
  }
  const compExpiresAt = cc.durationMonths ? addMonths(new Date(), cc.durationMonths) : null;
  await prisma.$transaction([
    prisma.compCode.update({
      where: { id: cc.id },
      data: { timesRedeemed: { increment: 1 } },
    }),
    prisma.organization.update({
      where: { id: tenantId },
      data: {
        compTier: cc.tier,
        compExpiresAt,
        seatLimit: PLAN_INFO[cc.tier].includedSeats,
        // A comp is full access — clear any nonpayment lock.
        billingSuspendedAt: null,
      },
    }),
  ]);
  return { ok: true, tier: cc.tier };
}

/** Operator: grant a comp directly to a workspace (no code needed). */
export async function grantComp(
  tenantId: string,
  tier: PlanTier,
  durationMonths: number | null,
): Promise<void> {
  await prisma.organization.update({
    where: { id: tenantId },
    data: {
      compTier: CODE_TIERS.includes(tier) ? tier : "PRO",
      compExpiresAt: durationMonths ? addMonths(new Date(), durationMonths) : null,
      seatLimit: PLAN_INFO[tier].includedSeats,
      billingSuspendedAt: null,
    },
  });
}

/** Operator: remove a comp grant (reverts to whatever Stripe/planTier says). */
export async function revokeComp(tenantId: string): Promise<void> {
  await prisma.organization.update({
    where: { id: tenantId },
    data: { compTier: null, compExpiresAt: null },
  });
}
