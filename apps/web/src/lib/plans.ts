import { CreditLedgerReason, type PlanTier, prisma, withTenant } from "@freehold/db";

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
    /** Voice-search sessions per month; 0 = not included, null = uncapped. */
    voiceSessionsPerMonth: number | null;
    /** The Handbook — team notes, grades and the daily summary. */
    handbook: boolean;
  }
> = {
  FREE: {
    label: "Free",
    priceMonthly: 0,
    includedSeats: 1,
    activeTransactionLimit: 2,
    portalClientLimit: 5,
    voiceSessionsPerMonth: 0,
    handbook: false,
  },
  PRO: {
    label: "Pro",
    priceMonthly: 50,
    includedSeats: 2,
    activeTransactionLimit: 8,
    portalClientLimit: null,
    voiceSessionsPerMonth: 100,
    handbook: true,
  },
  BUSINESS: {
    label: "Business",
    priceMonthly: 80,
    includedSeats: 10,
    activeTransactionLimit: null,
    portalClientLimit: null,
    voiceSessionsPerMonth: 300,
    handbook: true,
  },
};

/** Credits a brand-new Free workspace starts with (mirrors the DB default).
 *  Zero: Free carries no included AI — buying a credit pack is the only way
 *  to try AI without upgrading to Pro. */
export const FREE_STARTING_CREDITS = 0;

/**
 * Buyable credit packs. `credits` doubles as the pack key and maps to the
 * STRIPE_PRICE_CREDIT_<credits> env price in ee-billing. Bigger packs are
 * cheaper per credit ($5 / $4 / $3).
 */
export const CREDIT_PACKS = [
  { credits: 1, amountUsd: 5 },
  { credits: 5, amountUsd: 20 },
  { credits: 10, amountUsd: 30 },
] as const;

/** Valid pack sizes, for server-side validation of a purchase request. */
export const CREDIT_PACK_SIZES = CREDIT_PACKS.map((p) => p.credits) as readonly number[];

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
  /** When the comp grant lapses (null = comped indefinitely, or not comped at all). */
  compExpiresAt: Date | null;
  /** True when the workspace is locked for a failed renewal (Cloud only). */
  suspended: boolean;
}

/** A comp grant is in force while set and not past its expiry. */
function compIsActive(compTier: PlanTier | null, compExpiresAt: Date | null): boolean {
  return compTier != null && (compExpiresAt == null || compExpiresAt.getTime() > Date.now());
}

/** The tier that actually governs limits: a live comp overrides planTier. */
export function effectiveTier(org: {
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
    // Free's seat cap is fixed by the plan (1), not the stored column — an org
    // that was previously on a paid tier keeps a stale seat_limit otherwise.
    // Paid tiers keep the Stripe-driven stored value; a comp uses its tier's.
    seatLimit: comped || tier === "FREE" ? PLAN_INFO[tier].includedSeats : org.seatLimit,
    stripeCustomerId: org.stripeCustomerId,
    stripeSubscriptionId: org.stripeSubscriptionId,
    activeTransactionLimit: PLAN_INFO[tier].activeTransactionLimit,
    comped,
    compExpiresAt: comped ? org.compExpiresAt : null,
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

/** A workspace's current prepaid AI-credit balance. */
export async function creditBalance(tenantId: string): Promise<number> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { aiCredits: true },
  });
  return org.aiCredits;
}

/**
 * Whether a transaction may use pro AI features (contract extraction, AI
 * classify, in-transaction dictation). Always true on self-host and for any
 * paid/comped plan — their AI is unmetered. On Cloud Free it is true only once
 * a credit has been spent on this specific transaction (proFeaturesEnabled).
 *
 * Callers that already loaded the transaction pass its flag directly, so this
 * costs at most one plan lookup and never re-reads the row.
 */
export async function transactionHasPro(
  tenantId: string,
  proFeaturesEnabled: boolean,
): Promise<boolean> {
  if (!isCloud()) return true;
  if (proFeaturesEnabled) return true;
  const plan = await getTenantPlan(tenantId);
  return proAllowed(plan.tier, proFeaturesEnabled, true);
}

/**
 * The pure pro-AI decision: self-host is always pro; on Cloud, a paid/comped
 * tier is always pro, and Free is pro only for a transaction that spent a
 * credit. Extracted so it can be unit-tested without a database.
 */
export function proAllowed(tier: PlanTier, proFeaturesEnabled: boolean, cloud: boolean): boolean {
  if (!cloud) return true;
  if (proFeaturesEnabled) return true;
  return tier !== "FREE";
}

export interface SpendResult {
  ok: boolean;
  reason?: "no_credits" | "not_found";
  /** Balance after the spend (or the current balance when already on). */
  balance?: number;
  /** True when the transaction was already pro — no credit was charged. */
  alreadyOn?: boolean;
}

/**
 * Spend one credit to permanently unlock pro AI on a transaction. Atomic: the
 * balance is decremented only when a credit is available (guarding against a
 * double click), the transaction is flagged, and the movement is written to the
 * ledger — all in one tenant-scoped transaction. Idempotent: a transaction that
 * is already pro returns ok without charging again.
 */
export async function spendCreditForTransaction(
  tenantId: string,
  transactionId: string,
  userId: string,
): Promise<SpendResult> {
  return withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUnique({
      where: { id: transactionId },
      select: { proFeaturesEnabled: true },
    });
    if (!txn) return { ok: false, reason: "not_found" };
    if (txn.proFeaturesEnabled) {
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: tenantId },
        select: { aiCredits: true },
      });
      return { ok: true, alreadyOn: true, balance: org.aiCredits };
    }
    // Conditional decrement: succeeds for exactly one of two racing clicks.
    const dec = await tx.organization.updateMany({
      where: { id: tenantId, aiCredits: { gt: 0 } },
      data: { aiCredits: { decrement: 1 } },
    });
    if (dec.count === 0) return { ok: false, reason: "no_credits" };
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { aiCredits: true },
    });
    await tx.transaction.update({
      where: { id: transactionId },
      data: { proFeaturesEnabled: true, proEnabledAt: new Date(), proEnabledBy: userId },
    });
    await tx.creditLedger.create({
      data: {
        tenantId,
        delta: -1,
        reason: CreditLedgerReason.SPEND,
        balanceAfter: org.aiCredits,
        transactionId,
      },
    });
    return { ok: true, balance: org.aiCredits };
  });
}

/**
 * Add credits to a workspace (purchase, coupon, or an operator grant) and log
 * the movement. Returns the new balance. The balance and ledger update together
 * in one transaction so they can never drift.
 */
export async function grantCredits(
  tenantId: string,
  amount: number,
  reason: CreditLedgerReason,
  note?: string,
): Promise<number> {
  if (amount <= 0) return creditBalance(tenantId);
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id: tenantId },
      data: { aiCredits: { increment: amount } },
      select: { aiCredits: true },
    });
    await tx.creditLedger.create({
      data: {
        tenantId,
        delta: amount,
        reason,
        balanceAfter: org.aiCredits,
        ...(note ? { note } : {}),
      },
    });
    return org.aiCredits;
  });
}

export interface VoiceQuotaState {
  limited: boolean;
  used: number;
  limit: number | null;
}

/** One month from now, used to open a fresh voice-quota window. */
function nextMonth(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Voice search burns three metered APIs per session (speech-to-text, Claude,
 * text-to-speech), so unlike dictation's flat tier gate this is counted — a
 * single enthusiastic workspace shouldn't be able to drain the shared
 * text-to-speech budget in an afternoon. The window rolls monthly because the
 * upstream budget does. Self-host is never metered: they bring their own keys.
 */
export async function voiceQuotaState(tenantId: string): Promise<VoiceQuotaState> {
  if (!isCloud()) return { limited: false, used: 0, limit: null };
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: {
      planTier: true,
      compTier: true,
      compExpiresAt: true,
      voiceSessionsUsed: true,
      voiceQuotaResetAt: true,
    },
  });
  const limit = PLAN_INFO[effectiveTier(org)].voiceSessionsPerMonth;
  if (limit == null) return { limited: false, used: org.voiceSessionsUsed, limit: null };
  // An elapsed window means this month's count is zero, whatever the column says.
  const expired = org.voiceQuotaResetAt != null && org.voiceQuotaResetAt.getTime() <= Date.now();
  const used = expired ? 0 : org.voiceSessionsUsed;
  return { limited: used >= limit, used, limit };
}

/** Count one voice session, rolling the monthly window when it has elapsed. */
export async function recordVoiceSession(tenantId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { voiceQuotaResetAt: true },
  });
  const rollover = org?.voiceQuotaResetAt == null || org.voiceQuotaResetAt.getTime() <= Date.now();
  await prisma.organization.update({
    where: { id: tenantId },
    data: rollover
      ? { voiceSessionsUsed: 1, voiceQuotaResetAt: nextMonth() }
      : { voiceSessionsUsed: { increment: 1 } },
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

/**
 * What the Handbook is allowed to do in this workspace.
 *
 * Three independent gates, resolved together so a caller can't accidentally
 * honour one and forget another:
 *   * the plan (paid only on cloud; self-hosted installs get everything, the
 *     same rule `proAllowed` already applies),
 *   * the workspace's own switch, for a team that simply doesn't want it,
 *   * a second switch for the AI summary alone, so someone who dislikes AI
 *     keeps the notes — which is the half that works with no model call.
 *
 * `locked` is the one the UI reads to decide between showing a teaser with an
 * upgrade link and showing nothing at all: a feature turned off deliberately
 * should disappear, but a feature the plan withholds should be visible enough
 * to be worth upgrading for.
 */
export interface HandbookState {
  /** Notes, pooling and grades are usable. */
  notes: boolean;
  /** The AI "Today at a glance" summary may be generated. */
  summary: boolean;
  /** Withheld by the plan rather than switched off — show the upgrade teaser. */
  locked: boolean;
}

export async function handbookState(tenantId: string): Promise<HandbookState> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { handbookEnabled: true, handbookSummaryEnabled: true },
  });
  const { tier } = await getTenantPlan(tenantId);
  const allowedByPlan = !isCloud() || PLAN_INFO[tier].handbook;
  const on = org?.handbookEnabled ?? true;

  if (!allowedByPlan) return { notes: false, summary: false, locked: true };
  return {
    notes: on,
    summary: on && (org?.handbookSummaryEnabled ?? true),
    locked: false,
  };
}
