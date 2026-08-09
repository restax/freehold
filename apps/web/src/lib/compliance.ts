import {
  type ComplianceSide,
  ComplianceSlotStatus,
  ComplianceStatus,
  type TenantTx,
  type TransactionSide,
} from "@freehold/db";

/**
 * Compliance rounds. A transaction under a compliance-enabled client carries a
 * snapshot of that client's checklist — required documents as slots, each moving
 * MISSING → ATTACHED → SUBMITTED → APPROVED or RETURNED. The round's overall
 * status rolls up from its slots. Snapshotting means editing a template never
 * rewrites a file already under review; a new round is a new version.
 */

/** How a transaction's side maps onto the client's per-side defaults. */
export interface SideDefaults {
  complianceBuyId: string | null;
  complianceSellId: string | null;
  complianceDualId: string | null;
  /** The original single assignment, used when no side-specific one is set. */
  complianceChecklistId: string | null;
}

/**
 * Which checklist a file should get, given its side.
 *
 * Most specific wins: the matching side's default, then the client's general
 * fallback. Returning null means this client has nothing to apply, which is a
 * legitimate state (compliance on, no checklist chosen yet) and not an error.
 */
export function checklistForSide(side: TransactionSide, defaults: SideDefaults): string | null {
  // BORROWER has no per-side column on purpose: a private lender's files are
  // all the same shape, so there is nothing for a buy/sell/dual split to
  // distinguish. Their one assignment is the general one, and falling through
  // to the DUAL column here would hand a lending file a sale checklist.
  const bySide =
    side === "BUY_SIDE"
      ? defaults.complianceBuyId
      : side === "SELL_SIDE"
        ? defaults.complianceSellId
        : side === "DUAL"
          ? defaults.complianceDualId
          : null;
  return bySide ?? defaults.complianceChecklistId ?? null;
}

/**
 * Whether a checklist is a sensible choice for a given transaction side.
 *
 * BOTH fits any *sale* side. It does not fit a lending file: a workspace's
 * catch-all sale list would ask a loan for a listing agreement, which is the
 * one pairing worth warning about rather than waving through. Advisory only —
 * it drives a warning in the picker, never a refusal to save.
 */
export function sideFits(checklistSide: ComplianceSide, txnSide: TransactionSide): boolean {
  if (txnSide === "BORROWER" || checklistSide === "BORROWER") {
    return checklistSide === "BORROWER" && txnSide === "BORROWER";
  }
  if (checklistSide === "BOTH") return true;
  return checklistSide === txnSide;
}

export const SIDE_LABEL: Record<ComplianceSide, string> = {
  BUY_SIDE: "Buy side",
  SELL_SIDE: "Sell side",
  DUAL: "Dual",
  BOTH: "Any side",
  BORROWER: "Lending",
};

export interface RollupSlot {
  required: boolean;
  status: ComplianceSlotStatus;
}

/**
 * A member's review authority for a round. An explicitly assigned tier wins —
 * including 0, which strips review rights from an admin. Without one,
 * owners/admins hold top authority (whatever the round requires) and members
 * submit only. This is why single-level workspaces that never touch tiers see
 * exactly the old owner-or-admin behavior.
 */
export function effectiveTier(
  role: string,
  assigned: number | null,
  approvalLevels: number,
): number {
  if (assigned !== null) return assigned;
  return role === "owner" || role === "admin" ? approvalLevels : 0;
}

/**
 * Overall status from the slots. Anything sent back outranks everything else —
 * a file with a returned document needs work regardless of what else passed.
 * Only the required slots gate approval; optional ones are tracked, never
 * blocking (unless the checklist is entirely optional, in which case they are
 * all that's left to judge by).
 */
export function rollupStatus(slots: RollupSlot[]): ComplianceStatus {
  if (slots.length === 0) return ComplianceStatus.DRAFT;
  if (slots.some((s) => s.status === ComplianceSlotStatus.RETURNED)) {
    return ComplianceStatus.CHANGES_REQUESTED;
  }
  const gating = slots.filter((s) => s.required);
  const pool = gating.length > 0 ? gating : slots;
  if (pool.every((s) => s.status === ComplianceSlotStatus.APPROVED)) {
    return ComplianceStatus.APPROVED;
  }
  if (slots.some((s) => s.status === ComplianceSlotStatus.SUBMITTED)) {
    return ComplianceStatus.SUBMITTED;
  }
  return ComplianceStatus.DRAFT;
}

/** Recompute and persist a round's status from its slots. Returns the new status. */
export async function refreshComplianceStatus(
  tx: TenantTx,
  complianceId: string,
): Promise<ComplianceStatus> {
  const slots = await tx.complianceSlot.findMany({
    where: { complianceId },
    select: { required: true, status: true },
  });
  const status = rollupStatus(slots);
  await tx.transactionCompliance.update({
    where: { id: complianceId },
    data: {
      status,
      ...(status === ComplianceStatus.APPROVED ? { reviewedAt: new Date() } : {}),
    },
  });
  return status;
}

export interface StartRoundResult {
  ok: boolean;
  /** Why no round was started, for the caller to surface. */
  reason?: "no-client" | "compliance-off" | "no-checklist";
  complianceId?: string;
}

/**
 * Snapshot the client's checklist onto a transaction as a new round. Any
 * existing round is superseded (kept for history), and the new one starts at
 * version+1 — how a file picks up a fresh checklist version part-way through.
 */
export async function startComplianceRound(
  tx: TenantTx,
  tenantId: string,
  transactionId: string,
): Promise<StartRoundResult> {
  const txn = await tx.transaction.findUnique({
    where: { id: transactionId },
    select: {
      side: true,
      client: {
        select: {
          complianceEnabled: true,
          complianceChecklistId: true,
          complianceBuyId: true,
          complianceSellId: true,
          complianceDualId: true,
        },
      },
    },
  });
  if (!txn?.client) return { ok: false, reason: "no-client" };
  if (!txn.client.complianceEnabled) return { ok: false, reason: "compliance-off" };
  // The file's side decides which of the client's defaults applies, falling
  // back to their general assignment. See checklistForSide.
  const checklistId = checklistForSide(txn.side, txn.client);
  if (!checklistId) return { ok: false, reason: "no-checklist" };
  const checklist = await tx.complianceChecklist.findUnique({
    where: { id: checklistId },
    select: {
      id: true,
      name: true,
      approvalLevels: true,
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!checklist) return { ok: false, reason: "no-checklist" };

  const prior = await tx.transactionCompliance.findFirst({
    where: { transactionId },
    orderBy: { version: "desc" },
    select: { id: true, version: true },
  });
  if (prior) {
    await tx.transactionCompliance.updateMany({
      where: { transactionId, isCurrent: true },
      data: { isCurrent: false },
    });
  }

  const created = await tx.transactionCompliance.create({
    data: {
      tenantId,
      transactionId,
      checklistId: checklist.id,
      checklistName: checklist.name,
      approvalLevels: checklist.approvalLevels,
      version: (prior?.version ?? 0) + 1,
      slots: {
        create: checklist.items.map((i) => ({
          tenantId,
          name: i.name,
          description: i.description,
          required: i.required,
          paymentTracked: i.paymentTracked,
          sortOrder: i.sortOrder,
        })),
      },
    },
    select: { id: true },
  });
  return { ok: true, complianceId: created.id };
}

export const SLOT_LABEL: Record<ComplianceSlotStatus, string> = {
  MISSING: "Missing",
  ATTACHED: "Ready to submit",
  SUBMITTED: "In review",
  APPROVED: "Approved",
  RETURNED: "Returned",
};

export const STATUS_LABEL: Record<ComplianceStatus, string> = {
  DRAFT: "Assembling",
  SUBMITTED: "In review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
};

/** Badge tone for a round's status, shared by the transaction tab and the queue. */
export const STATUS_TONE: Record<ComplianceStatus, "success" | "danger" | "progress" | "neutral"> =
  {
    DRAFT: "neutral",
    SUBMITTED: "progress",
    CHANGES_REQUESTED: "danger",
    APPROVED: "success",
  };

export interface CompliancePprogressInput {
  required: boolean;
  status: ComplianceSlotStatus;
}

export interface ComplianceProgress {
  /** Required slots that have cleared review. */
  done: number;
  /** Required slots in total; optional ones never gate a file. */
  total: number;
  remaining: number;
  /** 0-100, for the bar. 100 when there is nothing required. */
  percent: number;
  /** Required slots a reviewer sent back, which need action before anything else. */
  returned: number;
}

/**
 * "4 of 10 required documents remaining", as shown on the transaction.
 *
 * Only required slots count. An optional document sitting unattached should
 * never make a file look incomplete, because it can't block the close.
 */
export function complianceProgress(slots: CompliancePprogressInput[]): ComplianceProgress {
  const required = slots.filter((s) => s.required);
  const done = required.filter((s) => s.status === ComplianceSlotStatus.APPROVED).length;
  const returned = required.filter((s) => s.status === ComplianceSlotStatus.RETURNED).length;
  const total = required.length;
  return {
    done,
    total,
    remaining: total - done,
    percent: total === 0 ? 100 : Math.round((done / total) * 100),
    returned,
  };
}
