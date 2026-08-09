"use server";

import { ComplianceSlotStatus, prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { effectiveTier, refreshComplianceStatus, startComplianceRound } from "@/lib/compliance";
import { confirmed, intOr, oneOf, optStr, str } from "@/lib/forms";
import { LENDING_CHECKLIST_NAME, LENDING_DOCUMENTS, PAYMENT_CHOICES } from "@/lib/lending";
import { getMemberCompliance, requireAdminTenant, requireTenant } from "@/lib/tenant";

/** The sides a checklist can be written for; mirrors the ComplianceSide enum. */
const COMPLIANCE_SIDES = ["BUY_SIDE", "SELL_SIDE", "DUAL", "BOTH", "BORROWER"] as const;

/**
 * Compliance checklists: the set of documents a file must carry to pass
 * review. Defined once per workspace, assigned to a Client so every
 * transaction for that client inherits the same rules — and switchable off
 * per client. Distinct from action plans, which produce dated tasks.
 */

export async function createChecklist(formData: FormData) {
  const { tenantId } = await requireTenant();
  const name = str(formData, "name");
  if (!name) return;
  const created = await withTenant(tenantId, (tx) =>
    tx.complianceChecklist.create({
      data: {
        tenantId,
        name,
        description: optStr(formData, "description"),
        side: oneOf(formData, "side", COMPLIANCE_SIDES, "BOTH"),
      },
    }),
  );
  revalidatePath("/dashboard/compliance");
  redirect(`/dashboard/compliance/${created.id}`);
}

/**
 * Create the standard lending package as a checklist, ready to edit.
 *
 * Thirteen documents that every private lending file needs is a lot to type
 * in by hand, and getting one of them wrong is the kind of mistake that
 * surfaces at underwriting rather than here. So the list ships, the workspace
 * owns it from the moment it's created, and anything that doesn't match how
 * this lender works gets edited or deleted on the next screen.
 *
 * Gated on the workspace actually being in private lending — the whole
 * feature is opt-in, and a sale-only workspace has no use for it.
 */
export async function createLendingChecklist() {
  const { tenantId, session } = await requireTenant();
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { privateLendingEnabled: true },
  });
  if (!org?.privateLendingEnabled) return;

  const created = await withTenant(tenantId, (tx) =>
    tx.complianceChecklist.create({
      data: {
        tenantId,
        name: LENDING_CHECKLIST_NAME,
        description: "What underwriting expects on a private lending file.",
        side: "BORROWER",
        items: {
          create: LENDING_DOCUMENTS.map((d, i) => ({
            tenantId,
            name: d.name,
            description: d.description ?? null,
            required: d.required,
            paymentTracked: d.paymentTracked ?? false,
            sortOrder: i,
          })),
        },
      },
      select: { id: true },
    }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "compliance.checklist_created",
    summary: `Created the standard lending package (${LENDING_DOCUMENTS.length} documents)`,
  });
  revalidatePath("/dashboard/compliance");
  redirect(`/dashboard/compliance/${created.id}`);
}

export async function deleteChecklist(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const id = str(formData, "id");
  if (!id || !isAdmin || !confirmed(formData)) return;
  // Clients pointing at this checklist fall back to no rules (FK is SET NULL).
  await withTenant(tenantId, (tx) => tx.complianceChecklist.delete({ where: { id } }));
  revalidatePath("/dashboard/compliance");
  redirect("/dashboard/compliance");
}

/**
 * Rename a checklist and set what it covers.
 *
 * A list created as "Buy-side file" and later reused for listings had no way
 * to be corrected: create and delete were the only operations, so fixing a
 * typo meant deleting the list and re-adding every item, which also detached
 * every client pointing at it.
 *
 * Side is advisory metadata. It steers the per-side client defaults and warns
 * on an odd pairing; it never refuses to apply a list to a file.
 */
export async function updateChecklist(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return;
  const side = oneOf(formData, "side", COMPLIANCE_SIDES, "BOTH");
  const levels = intOr(formData, "approvalLevels", 1) ?? 1;

  const before = await withTenant(tenantId, (tx) =>
    tx.complianceChecklist.findUnique({ where: { id }, select: { name: true } }),
  );
  if (!before) return;
  await withTenant(tenantId, (tx) =>
    tx.complianceChecklist.update({
      where: { id },
      data: {
        name,
        description: optStr(formData, "description"),
        side,
        ...(levels >= 1 && levels <= 3 ? { approvalLevels: levels } : {}),
      },
    }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "compliance.checklist_updated",
    summary:
      before.name === name
        ? `Updated checklist "${name}"`
        : `Renamed checklist "${before.name}" to "${name}"`,
  });
  revalidatePath(`/dashboard/compliance/${id}`);
  revalidatePath("/dashboard/compliance");
}

/** Edit one required document on a checklist: its name, note, and whether it
 *  blocks a file from passing. */
export async function updateChecklistItem(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const checklistId = str(formData, "checklistId");
  const name = str(formData, "name");
  if (!id || !checklistId || !name) return;
  await withTenant(tenantId, (tx) =>
    tx.complianceItem.update({
      where: { id },
      data: {
        name,
        description: optStr(formData, "description"),
        required: formData.get("required") === "on",
        paymentTracked: formData.get("paymentTracked") === "on",
      },
    }),
  );
  revalidatePath(`/dashboard/compliance/${checklistId}`);
}

/** Remove several documents at once from the checklist's own screen. */
export async function deleteChecklistItems(formData: FormData) {
  const { tenantId } = await requireTenant();
  const checklistId = str(formData, "checklistId");
  const ids = formData.getAll("ids").filter((v): v is string => typeof v === "string" && v !== "");
  if (!checklistId || ids.length === 0) return;
  // Scoped to this checklist as well as the tenant: an id from another list
  // arriving in the form array shouldn't delete anything.
  await withTenant(tenantId, (tx) =>
    tx.complianceItem.deleteMany({ where: { id: { in: ids }, checklistId } }),
  );
  revalidatePath(`/dashboard/compliance/${checklistId}`);
}

/** Delete several checklists from the index. */
export async function deleteChecklists(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const ids = formData.getAll("ids").filter((v): v is string => typeof v === "string" && v !== "");
  if (ids.length === 0) return;
  await withTenant(tenantId, (tx) =>
    tx.complianceChecklist.deleteMany({ where: { id: { in: ids } } }),
  );
  revalidatePath("/dashboard/compliance");
}

export async function addChecklistItem(formData: FormData) {
  const { tenantId } = await requireTenant();
  const checklistId = str(formData, "checklistId");
  const name = str(formData, "name");
  if (!checklistId || !name) return;
  await withTenant(tenantId, async (tx) => {
    const max = await tx.complianceItem.aggregate({
      where: { checklistId },
      _max: { sortOrder: true },
    });
    await tx.complianceItem.create({
      data: {
        tenantId,
        checklistId,
        name,
        description: optStr(formData, "description"),
        // Unchecked "required" means the document is tracked but never blocks.
        required: formData.get("required") === "on",
        paymentTracked: formData.get("paymentTracked") === "on",
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
  });
  revalidatePath(`/dashboard/compliance/${checklistId}`);
}

export async function deleteChecklistItem(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const checklistId = str(formData, "checklistId");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.complianceItem.delete({ where: { id } }));
  revalidatePath(`/dashboard/compliance/${checklistId}`);
}

/**
 * Assign (or clear) a client's checklist and switch compliance on/off for
 * them. Admin-only: these rules govern what every file for the client must
 * carry, so turning them off is an owner-level decision and is audited.
 */
export async function setClientCompliance(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const clientId = str(formData, "clientId");
  if (!clientId) return;
  const enabled = formData.get("enabled") === "on";
  const checklistId = optStr(formData, "checklistId");
  // Per-side defaults. Left blank, a side simply falls back to the general
  // assignment above; see checklistForSide.
  const buyId = optStr(formData, "complianceBuyId");
  const sellId = optStr(formData, "complianceSellId");
  const dualId = optStr(formData, "complianceDualId");

  const client = await withTenant(tenantId, (tx) =>
    tx.client.update({
      where: { id: clientId },
      data: {
        complianceEnabled: enabled,
        complianceChecklistId: checklistId,
        complianceBuyId: buyId,
        complianceSellId: sellId,
        complianceDualId: dualId,
      },
      select: { name: true, complianceChecklist: { select: { name: true } } },
    }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "compliance.client_rules_changed",
    summary: enabled
      ? `Compliance ON for ${client.name}${
          client.complianceChecklist
            ? ` — checklist "${client.complianceChecklist.name}"`
            : " — no checklist assigned"
        }`
      : `Compliance switched OFF for ${client.name}`,
  });
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/compliance");
}

/**
 * How many levels of reviewer sign-off this checklist's documents need.
 * Admin-only and audited like the client rules — it changes who can pass a
 * file. Applies to rounds started after the change; running rounds keep the
 * levels they were snapshotted with.
 */
export async function setChecklistApprovalLevels(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const checklistId = str(formData, "checklistId");
  const levels = intOr(formData, "approvalLevels", 1) ?? 1;
  if (!checklistId || levels < 1 || levels > 3) return;
  const checklist = await withTenant(tenantId, (tx) =>
    tx.complianceChecklist.update({
      where: { id: checklistId },
      data: { approvalLevels: levels },
      select: { name: true },
    }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "compliance.approval_levels_changed",
    summary: `"${checklist.name}" now needs ${levels} level${levels === 1 ? "" : "s"} of sign-off`,
  });
  revalidatePath(`/dashboard/compliance/${checklistId}`);
}

// --- Per-transaction compliance rounds (submit → review → approve/return) ---

/**
 * Start a compliance round on a transaction from its client's checklist, or
 * open a fresh version when one already exists. Snapshotting the checklist
 * means later template edits never rewrite a file already under review.
 */
export async function startRound(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  if (!transactionId) return;
  const result = await withTenant(tenantId, (tx) =>
    startComplianceRound(tx, tenantId, transactionId),
  );
  if (result.ok) {
    logAudit({
      tenantId,
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "compliance.round_started",
      summary: "Started a compliance round on a transaction",
    });
  }
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/** Point a checklist slot at one of the transaction's documents (or clear it). */
export async function attachSlotDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const slotId = str(formData, "slotId");
  const transactionId = str(formData, "transactionId");
  const documentId = optStr(formData, "documentId");
  if (!slotId) return;
  await withTenant(tenantId, async (tx) => {
    const slot = await tx.complianceSlot.findUniqueOrThrow({
      where: { id: slotId },
      select: { complianceId: true, status: true },
    });
    // Attaching (or swapping) a file puts the slot back in the submitter's
    // court; a previously returned slot becomes ready to send up again. New
    // bytes mean review starts over, so any partial sign-off is wiped.
    await tx.complianceSlot.update({
      where: { id: slotId },
      data: {
        documentId,
        status: documentId ? ComplianceSlotStatus.ATTACHED : ComplianceSlotStatus.MISSING,
        reviewNote: null,
        approvedTier: 0,
      },
    });
    await refreshComplianceStatus(tx, slot.complianceId);
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/**
 * Record where a tracked invoice stands.
 *
 * Separate from attaching the document because they are separate facts and
 * arrive at separate times: the appraisal invoice is on the file long before
 * anyone knows whether the borrower paid it COD. Clearing the answer is
 * allowed and means "nobody has said", which is not the same as UNPAID.
 *
 * Deliberately not a review action. Payment is bookkeeping the processor
 * owns; it never approves or returns a document, and it does not disturb the
 * slot's review status.
 */
export async function setSlotPayment(formData: FormData) {
  const { tenantId } = await requireTenant();
  const slotId = str(formData, "slotId");
  const transactionId = str(formData, "transactionId");
  const raw = optStr(formData, "paymentStatus");
  if (!slotId) return;
  const paymentStatus = raw && (PAYMENT_CHOICES as string[]).includes(raw) ? raw : null;
  // Scoped to slots that actually ask a payment question, so a hand-posted id
  // naming an ordinary document writes nothing.
  await withTenant(tenantId, (tx) =>
    tx.complianceSlot.updateMany({
      where: { id: slotId, paymentTracked: true },
      // biome-ignore lint/suspicious/noExplicitAny: narrowed against PAYMENT_CHOICES above
      data: { paymentStatus: paymentStatus as any },
    }),
  );
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/** Send the assembled file up for compliance review. */
export async function submitForReview(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const complianceId = str(formData, "complianceId");
  const transactionId = str(formData, "transactionId");
  if (!complianceId) return;
  await withTenant(tenantId, async (tx) => {
    // Only attached (or previously returned-then-refilled) slots move up;
    // already-approved ones stay approved.
    await tx.complianceSlot.updateMany({
      where: { complianceId, status: ComplianceSlotStatus.ATTACHED },
      data: { status: ComplianceSlotStatus.SUBMITTED },
    });
    await tx.transactionCompliance.update({
      where: { id: complianceId },
      data: { submittedAt: new Date(), submittedById: session.user.id },
    });
    await refreshComplianceStatus(tx, complianceId);
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "compliance.submitted",
    summary: "Submitted a file for compliance review",
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/compliance");
}

/**
 * Reviewer decision on one document: approve it, or return it with a note
 * saying what's wrong. Authority comes from the member's effective compliance
 * tier: an approval stamps the reviewer's level, and the slot only turns
 * APPROVED once the round's required levels are all covered — a higher tier's
 * sign-off subsumes the levels below it, so the ladder can't deadlock. Anyone
 * with review authority can return, wiping partial sign-offs.
 */
export async function reviewSlot(formData: FormData) {
  const { tenantId, userId, session } = await requireTenant();
  const slotId = str(formData, "slotId");
  const transactionId = str(formData, "transactionId");
  const decision = str(formData, "decision"); // "approve" | "return"
  const note = optStr(formData, "reviewNote");
  if (!slotId || (decision !== "approve" && decision !== "return")) return;
  const member = await getMemberCompliance(tenantId, userId);

  const outcome = await withTenant(tenantId, async (tx) => {
    const slot = await tx.complianceSlot.findUniqueOrThrow({
      where: { id: slotId },
      select: {
        name: true,
        status: true,
        approvedTier: true,
        complianceId: true,
        compliance: { select: { approvalLevels: true } },
      },
    });
    // Only submitted documents are up for a ruling.
    if (slot.status !== ComplianceSlotStatus.SUBMITTED) return null;
    const levels = slot.compliance.approvalLevels;
    const tier = effectiveTier(member.role, member.complianceTier, levels);
    if (tier < 1) return null; // no review authority
    // Approving below or at an already-covered level changes nothing.
    if (decision === "approve" && tier <= slot.approvedTier) return null;

    const approvedTier = decision === "approve" ? Math.max(slot.approvedTier, tier) : 0;
    const fullyApproved = decision === "approve" && approvedTier >= levels;
    await tx.complianceSlot.update({
      where: { id: slotId },
      data: {
        status:
          decision === "return"
            ? ComplianceSlotStatus.RETURNED
            : fullyApproved
              ? ComplianceSlotStatus.APPROVED
              : ComplianceSlotStatus.SUBMITTED,
        approvedTier,
        reviewNote: decision === "return" ? note : null,
        reviewedAt: new Date(),
        reviewedById: session.user.id,
      },
    });
    const status = await refreshComplianceStatus(tx, slot.complianceId);
    // Record who last ruled on this round, whichever way it went.
    await tx.transactionCompliance.update({
      where: { id: slot.complianceId },
      data: { reviewedById: session.user.id },
    });
    return { slotName: slot.name, status, tier, levels, fullyApproved };
  });
  if (!outcome) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: decision === "approve" ? "compliance.approved" : "compliance.returned",
    summary:
      decision === "approve"
        ? outcome.fullyApproved
          ? `Approved "${outcome.slotName}" — document cleared; file is now ${outcome.status}`
          : `Approved "${outcome.slotName}" at level ${outcome.tier} of ${outcome.levels} — awaiting level ${outcome.tier + 1}`
        : `Returned "${outcome.slotName}"${note ? `: ${note}` : ""}`,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/compliance");
}
