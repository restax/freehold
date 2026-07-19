import { type PlanTier, prisma, withTenant } from "@freehold/db";

/**
 * Cloud plan definitions and limit checks.
 *
 * Limits apply ONLY when FREEHOLD_CLOUD=1 — self-hosted Freehold is
 * unlimited forever, by policy (see docs/PLAN.md, "no caps anywhere on
 * self-host"). At a limit nothing is ever locked away: existing data stays
 * readable and exportable; only creating more is gated.
 */

export const PLAN_INFO: Record<
  PlanTier,
  {
    label: string;
    priceMonthly: number | null;
    includedSeats: number;
    activeTransactionLimit: number | null;
    /** Lifetime AI extraction trial credits; null = fair-use, not metered. */
    aiExtractionCredits: number | null;
  }
> = {
  FREE: {
    label: "Free",
    priceMonthly: 0,
    includedSeats: 2,
    activeTransactionLimit: 5,
    aiExtractionCredits: 10,
  },
  PRO: {
    label: "Pro",
    priceMonthly: 35,
    includedSeats: 2,
    activeTransactionLimit: 100,
    aiExtractionCredits: null,
  },
  BUSINESS: {
    label: "Business",
    priceMonthly: 80,
    includedSeats: 10,
    activeTransactionLimit: 200,
    aiExtractionCredits: null,
  },
};

export function isCloud(): boolean {
  return process.env.FREEHOLD_CLOUD === "1";
}

export interface TenantPlan {
  tier: PlanTier;
  seatLimit: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  activeTransactionLimit: number | null;
}

export async function getTenantPlan(tenantId: string): Promise<TenantPlan> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: {
      planTier: true,
      seatLimit: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });
  return {
    tier: org.planTier,
    seatLimit: org.seatLimit,
    stripeCustomerId: org.stripeCustomerId,
    stripeSubscriptionId: org.stripeSubscriptionId,
    activeTransactionLimit: PLAN_INFO[org.planTier].activeTransactionLimit,
  };
}

/** Transactions still in flight (anything not closed or cancelled). */
export async function countActiveTransactions(tenantId: string): Promise<number> {
  return withTenant(tenantId, (tx) =>
    tx.transaction.count({ where: { status: { notIn: ["CLOSED", "CANCELLED"] } } }),
  );
}

export interface TransactionLimitState {
  limited: boolean;
  active: number;
  limit: number | null;
}

/** Whether creating one more transaction is allowed right now. */
export async function transactionLimit(tenantId: string): Promise<TransactionLimitState> {
  if (!isCloud()) return { limited: false, active: 0, limit: null };
  const plan = await getTenantPlan(tenantId);
  if (plan.activeTransactionLimit == null) return { limited: false, active: 0, limit: null };
  const active = await countActiveTransactions(tenantId);
  return {
    limited: active >= plan.activeTransactionLimit,
    active,
    limit: plan.activeTransactionLimit,
  };
}

export interface ExtractionCreditState {
  limited: boolean;
  used: number;
  limit: number | null;
}

/**
 * Free-tier AI trial credits. Metered only on Cloud + FREE; paid tiers are
 * fair-use. Counted with a durable per-tenant counter (not row counts, so
 * deleting documents never refunds credits).
 */
export async function extractionCreditState(tenantId: string): Promise<ExtractionCreditState> {
  if (!isCloud()) return { limited: false, used: 0, limit: null };
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { planTier: true, aiExtractionsUsed: true },
  });
  const limit = PLAN_INFO[org.planTier].aiExtractionCredits;
  if (limit == null) return { limited: false, used: org.aiExtractionsUsed, limit: null };
  return { limited: org.aiExtractionsUsed >= limit, used: org.aiExtractionsUsed, limit };
}

/** Consume one trial credit after a successful extraction. */
export async function recordExtractionUse(tenantId: string): Promise<void> {
  await prisma.organization.update({
    where: { id: tenantId },
    data: { aiExtractionsUsed: { increment: 1 } },
  });
}

export interface SeatState {
  limited: boolean;
  used: number;
  limit: number;
}

/** Seats used = members + pending invitations. */
export async function seatState(tenantId: string): Promise<SeatState> {
  const plan = await getTenantPlan(tenantId);
  const [members, pending] = await Promise.all([
    prisma.member.count({ where: { organizationId: tenantId } }),
    prisma.invitation.count({ where: { organizationId: tenantId, status: "pending" } }),
  ]);
  const used = members + pending;
  return { limited: isCloud() && used >= plan.seatLimit, used, limit: plan.seatLimit };
}
