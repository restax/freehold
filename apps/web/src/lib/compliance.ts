import { ComplianceSlotStatus, ComplianceStatus, type TenantTx } from "@freehold/db";

/**
 * Compliance rounds. A transaction under a compliance-enabled client carries a
 * snapshot of that client's checklist — required documents as slots, each moving
 * MISSING → ATTACHED → SUBMITTED → APPROVED or RETURNED. The round's overall
 * status rolls up from its slots. Snapshotting means editing a template never
 * rewrites a file already under review; a new round is a new version.
 */

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
      client: {
        select: {
          complianceEnabled: true,
          complianceChecklist: {
            select: {
              id: true,
              name: true,
              approvalLevels: true,
              items: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!txn?.client) return { ok: false, reason: "no-client" };
  if (!txn.client.complianceEnabled) return { ok: false, reason: "compliance-off" };
  const checklist = txn.client.complianceChecklist;
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
