import { type PlanTier, prisma, withTenant } from "@freehold/db";

/**
 * Cloud plan definitions and limit checks.
 *
 * Limits apply ONLY when FREEHOLD_CLOUD=1 — self-hosted Freehold is
 * unlimited forever, by policy ("no caps anywhere on
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
    /** Distinct clients that may have portal links; null = uncapped. */
    portalClientLimit: number | null;
    /** Lifetime AI extraction trial credits; null = fair-use, not metered. */
    aiExtractionCredits: number | null;
  }
> = {
  FREE: {
    label: "Free",
    priceMonthly: 0,
    includedSeats: 2,
    activeTransactionLimit: 5,
    portalClientLimit: 5,
    aiExtractionCredits: 10,
  },
  PRO: {
    label: "Pro",
    priceMonthly: 40,
    includedSeats: 2,
    activeTransactionLimit: 50,
    portalClientLimit: 50,
    aiExtractionCredits: null,
  },
  BUSINESS: {
    label: "Business",
    priceMonthly: 85,
    includedSeats: 10,
    activeTransactionLimit: 100,
    portalClientLimit: 100,
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
  /** True when the effective tier comes from a complimentary grant, not Stripe. */
  comped: boolean;
  /** True when the workspace is locked for a failed renewal (Cloud only). */
  suspended: boolean;
}

/** A comp grant is in force while set and not past its expiry. */
function compIsActive(compTier: PlanTier | null, compExpiresAt: Date | null): boolean {
  return compTier != null && (compExpiresAt == null || compExpiresAt.getTime() > Date.now());
}

/** The tier that actually governs limits: a live comp overrides planTier. */
function effectiveTier(org: {
  planTier: PlanTier;
  compTier: PlanTier | null;
  compExpiresAt: Date | null;
}): PlanTier {
  return compIsActive(org.compTier, org.compExpiresAt) ? (org.compTier as PlanTier) : org.planTier;
}

export async function getTenantPlan(tenantId: string): Promise<TenantPlan> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: {
      planTier: true,
      seatLimit: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      compTier: true,
      compExpiresAt: true,
      billingSuspendedAt: true,
    },
  });
  const comped = compIsActive(org.compTier, org.compExpiresAt);
  const tier = comped ? (org.compTier as PlanTier) : org.planTier;
  return {
    tier,
    seatLimit: comped ? PLAN_INFO[tier].includedSeats : org.seatLimit,
    stripeCustomerId: org.stripeCustomerId,
    stripeSubscriptionId: org.stripeSubscriptionId,
    activeTransactionLimit: PLAN_INFO[tier].activeTransactionLimit,
    comped,
    // A comp always beats a stale suspension flag; otherwise honor the lock on Cloud.
    suspended: !comped && isCloud() && org.billingSuspendedAt != null,
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
    select: { planTier: true, aiExtractionsUsed: true, compTier: true, compExpiresAt: true },
  });
  const limit = PLAN_INFO[effectiveTier(org)].aiExtractionCredits;
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
    // Guests are outside coverage staff on an engagement, not staff you're
    // adding to the workspace — they never consume one of your seats.
    prisma.member.count({ where: { organizationId: tenantId, role: { not: "guest" } } }),
    prisma.invitation.count({ where: { organizationId: tenantId, status: "pending" } }),
  ]);
  const used = members + pending;
  return { limited: isCloud() && used >= plan.seatLimit, used, limit: plan.seatLimit };
}

/** Distinct clients that already have at least one portal link. */
export async function portalClientLimit(
  tenantId: string,
  clientIdToAdd: string | null,
): Promise<{ limited: boolean; used: number; limit: number | null }> {
  if (!isCloud()) return { limited: false, used: 0, limit: null };
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { planTier: true, compTier: true, compExpiresAt: true },
  });
  const limit = PLAN_INFO[effectiveTier(org)].portalClientLimit;
  if (limit == null) return { limited: false, used: 0, limit: null };
  const rows = await withTenant(tenantId, (tx) =>
    tx.portalLink.findMany({
      where: { revokedAt: null },
      select: { clientId: true, transaction: { select: { clientId: true } } },
    }),
  );
  const clients = new Set<string>();
  for (const r of rows) {
    const id = r.clientId ?? r.transaction?.clientId;
    if (id) clients.add(id);
  }
  const alreadyCounted = clientIdToAdd ? clients.has(clientIdToAdd) : false;
  return { limited: !alreadyCounted && clients.size >= limit, used: clients.size, limit };
}
