"use server";

import {
  prisma,
  type TenantTx,
  TransactionSide,
  TransactionStatus,
  withTenant,
} from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import type { ContractParty } from "@/lib/ai/contract-schema";
import { logAudit } from "@/lib/audit";
import { fireIntroEmail, firePostCloseEmail } from "@/lib/auto-emails";
import { ensureAutoDraft } from "@/lib/billing-drafts";
import { resolveDefaultFee, tenantBillingPolicy } from "@/lib/billing-policy";
import { confirmed, dateOnly, intOr, oneOf, optStr, str } from "@/lib/forms";
import { gapForPending, gapMessage, licenseEnforcement } from "@/lib/licensing";
import { parseFeeCents } from "@/lib/pay";
import { transactionLimit } from "@/lib/plans";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";
import { emitWebhook } from "@/lib/webhook-emit";

const STATUSES = Object.values(TransactionStatus);
const SIDES = Object.values(TransactionSide);

function commonFields(formData: FormData) {
  return {
    status: oneOf(formData, "status", STATUSES, TransactionStatus.UNDER_CONTRACT),
    side: oneOf(formData, "side", SIDES, TransactionSide.BUY_SIDE),
    clientId: optStr(formData, "clientId"),
    city: optStr(formData, "city"),
    state: optStr(formData, "state"),
    zip: optStr(formData, "zip"),
    purchasePrice: intOr(formData, "purchasePrice"),
    contractDate: dateOnly(formData, "contractDate"),
    closeDate: dateOnly(formData, "closeDate"),
    // Critical dates the staleness alerts escalate on. Unlike closeDate these
    // aren't contract-governed, so they edit directly without an amendment.
    mortgageCommitmentDate: dateOnly(formData, "mortgageCommitmentDate"),
    inspectionDeadlineDate: dateOnly(formData, "inspectionDeadlineDate"),
    listPrice: intOr(formData, "listPrice"),
    listDate: dateOnly(formData, "listDate"),
    onMarketDate: dateOnly(formData, "onMarketDate"),
    expireDate: dateOnly(formData, "expireDate"),
    mlsId: optStr(formData, "mlsId"),
    coAgentClientId: optStr(formData, "coAgentClientId"),
    notes: optStr(formData, "notes"),
    // Expected fee: only forms that carry the field can change it. Blank means
    // "fall back to the client/workspace default" (re-resolved below); an
    // explicit 0 means this file is deliberately not billed.
    ...(formData.has("expectedFee")
      ? { expectedFeeCents: parseFeeCents(str(formData, "expectedFee")) }
      : {}),
  };
}

/**
 * A file with no expected fee inherits the client's default (else the
 * workspace's). Runs after create/update so "blank" always means "default",
 * never silently zero — the trust surface depends on this number existing.
 */
async function resolvedExpectedFee(
  tx: TenantTx,
  tenantId: string,
  clientId: string | null | undefined,
  current: number | null | undefined,
): Promise<number | null> {
  if (current != null) return current;
  if (!clientId) return null;
  const [client, org] = await Promise.all([
    tx.client.findUnique({ where: { id: clientId }, select: { defaultFeeCents: true } }),
    prisma.organization.findUnique({ where: { id: tenantId }, select: { billingDefaults: true } }),
  ]);
  return resolveDefaultFee(client?.defaultFeeCents, tenantBillingPolicy(org?.billingDefaults));
}

/** Payout tab: commission percentages; gross computes from contract price. */
export async function updatePayout(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  const num = (n: string) => {
    const v = Number(str(formData, n));
    return Number.isFinite(v) && v >= 0 ? v : null;
  };
  await withTenant(tenantId, (tx) =>
    tx.transaction.update({
      where: { id },
      data: {
        payout: {
          listPct: num("listPct"),
          buyPct: num("buyPct"),
          note: optStr(formData, "payoutNote"),
        },
      },
    }),
  );
  revalidatePath(`/dashboard/transactions/${id}`);
}

export async function createTransaction(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const propertyAddress = str(formData, "propertyAddress");
  if (!propertyAddress) return;
  const limit = await transactionLimit(tenantId);
  if (limit.limited) return; // cloud free-tier cap; the page shows the upgrade banner
  const assigneeId = optStr(formData, "assigneeId");
  const fields = commonFields(formData);

  // Under "block" enforcement a file in a license-required state can't be
  // created without a licensed coordinator on it. Under "warn" it saves and
  // the file carries a flag instead.
  const enforcement = await licenseEnforcement(tenantId);
  if (enforcement === "block") {
    const gap = await withTenant(tenantId, (tx) =>
      gapForPending(tx, fields.state, assigneeId ? [assigneeId] : []),
    );
    if (gap) {
      // Back to the form that was being filled, not the list — the
      // coordinator needs to change the assignee and try again.
      redirect(`/dashboard/transactions/new?licenseError=${encodeURIComponent(gapMessage(gap))}`);
    }
  }

  const created = await withTenant(tenantId, async (tx) => {
    const expectedFeeCents = await resolvedExpectedFee(
      tx,
      tenantId,
      fields.clientId,
      fields.expectedFeeCents,
    );
    const txn = await tx.transaction.create({
      data: { tenantId, propertyAddress, ...fields, expectedFeeCents },
    });
    // Optional create-time assignment; more people can be added on the file.
    if (assigneeId) {
      await tx.transactionAssignee.create({
        data: { tenantId, transactionId: txn.id, userId: assigneeId },
      });
    }
    return txn;
  });
  // Billing policy may want an invoice at entry (upfront/per-entry modes) —
  // a reviewed DRAFT, never auto-sent.
  await ensureAutoDraft(tenantId, created.id, "entry");
  await emitWebhook(tenantId, "transaction.created", {
    id: created.id,
    propertyAddress: created.propertyAddress,
    status: created.status,
    side: created.side,
  });
  // Automated intro email to the client, unless switched off on their profile.
  fireIntroEmail(tenantId, created.id, session.user);
  revalidatePath("/dashboard/transactions");
  redirect(`/dashboard/transactions/${created.id}`);
}

export async function updateTransaction(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  const propertyAddress = str(formData, "propertyAddress");
  const fields = commonFields(formData);

  // Moving a file into a license-required state is the same decision as
  // creating one there, so it goes through the same gate.
  const enforcement = await licenseEnforcement(tenantId);
  if (enforcement === "block") {
    const gap = await withTenant(tenantId, async (tx) => {
      const assignees = await tx.transactionAssignee.findMany({
        where: { transactionId: id },
        select: { userId: true },
      });
      return gapForPending(
        tx,
        fields.state,
        assignees.map((a) => a.userId),
      );
    });
    if (gap) {
      redirect(`/dashboard/transactions/${id}?licenseError=${encodeURIComponent(gapMessage(gap))}`);
    }
  }

  const redirected: string[] = [];
  let closedNow = false;
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { contractDate: true, closeDate: true, proposedDates: true, status: true },
    });

    closedNow = existing.status !== "CLOSED" && fields.status === "CLOSED";

    // The contract is the source of truth: once a governed date exists,
    // editing it in the form becomes a proposal (amendment to-do), never a
    // silent change. First-time entry (null → value) applies directly and
    // dates the anchored tasks.
    const data: Record<string, unknown> = {
      ...(propertyAddress ? { propertyAddress } : {}),
      ...fields,
    };
    if ("expectedFeeCents" in fields && fields.expectedFeeCents == null) {
      data.expectedFeeCents = await resolvedExpectedFee(tx, tenantId, fields.clientId, null);
    }
    const proposed = { ...((existing.proposedDates as Record<string, string> | null) ?? {}) };
    for (const field of ["contractDate", "closeDate"] as const) {
      const next = fields[field];
      const prev = existing[field];
      if (prev && next && next.getTime() !== prev.getTime()) {
        delete data[field];
        const value = next.toISOString().slice(0, 10);
        proposed[field] = value;
        redirected.push(field);
        const open = await tx.task.findFirst({
          where: { transactionId: id, proposedFor: field, status: "OPEN" },
          select: { id: true },
        });
        const title = `Amendment needed: ${field === "closeDate" ? "closing date" : "contract date"} → ${value}`;
        if (open) {
          await tx.task.update({ where: { id: open.id }, data: { title } });
        } else {
          await tx.task.create({
            data: {
              tenantId,
              transactionId: id,
              title,
              priority: "HIGH",
              proposedFor: field,
              dueDate: new Date(),
              assigneeId: session.user.id,
            },
          });
        }
      } else if (!prev && next) {
        // Initial entry: apply directly; anchored tasks may now get dates.
      } else {
        delete data[field];
      }
    }
    if (redirected.length > 0) data.proposedDates = proposed;

    const updated = await tx.transaction.update({
      where: { id },
      data,
      select: { contractDate: true, closeDate: true },
    });
    await recomputeAnchoredTasks(tx, id, updated);
  });
  if (closedNow) {
    firePostCloseEmail(tenantId, id, session.user);
    // The closing billing moment: draft whatever expected fee remains unbilled.
    await ensureAutoDraft(tenantId, id, "close");
  }

  if (redirected.length > 0) {
    logAudit({
      tenantId,
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "transaction.date_proposed",
      summary: `Date edit routed to proposal (${redirected.join(", ")}) — contract governs`,
      subjectType: "transaction",
      subjectId: id,
    });
  }
  logActivity({
    tenantId,
    transactionId: id,
    actor: session.user,
    action: "transaction.updated",
    summary: "Updated transaction details",
  });
  revalidatePath(`/dashboard/transactions/${id}`);
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard");
}

export async function setCustomField(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const key = str(formData, "key");
  if (!id || !key) return;
  const value = str(formData, "value");
  await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { customFields: true },
    });
    const fields = { ...((txn.customFields as Record<string, string> | null) ?? {}), [key]: value };
    await tx.transaction.update({ where: { id }, data: { customFields: fields } });
  });
  revalidatePath(`/dashboard/transactions/${id}`);
}

export async function removeCustomField(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const key = str(formData, "key");
  if (!id || !key) return;
  await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { customFields: true },
    });
    const fields = { ...((txn.customFields as Record<string, string> | null) ?? {}) };
    delete fields[key];
    await tx.transaction.update({ where: { id }, data: { customFields: fields } });
  });
  revalidatePath(`/dashboard/transactions/${id}`);
}

/**
 * The locked contract-parties panel: an ordered role/value list, separate from
 * customFields so a party can't be casually deleted. Populated by extraction
 * and hand-editable here.
 */
export async function addTransactionParty(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const role = str(formData, "role") || "other";
  const value = str(formData, "value");
  if (!id || !value) return;
  await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { contractParties: true },
    });
    const parties = [...((txn.contractParties as ContractParty[] | null) ?? [])];
    if (!parties.some((p) => p.role === role && p.value === value)) {
      parties.push({ role, value });
    }
    await tx.transaction.update({
      where: { id },
      data: { contractParties: parties as unknown as Record<string, string>[] },
    });
  });
  revalidatePath(`/dashboard/transactions/${id}`);
}

export async function removeTransactionParty(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const role = str(formData, "role");
  const value = str(formData, "value");
  if (!id) return;
  await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { contractParties: true },
    });
    const parties = ((txn.contractParties as ContractParty[] | null) ?? []).filter(
      (p) => !(p.role === role && p.value === value),
    );
    await tx.transaction.update({
      where: { id },
      data: { contractParties: parties as unknown as Record<string, string>[] },
    });
  });
  revalidatePath(`/dashboard/transactions/${id}`);
}

/**
 * The required-documents checklist on the Documents tab. Slots are seeded when
 * an action plan is applied and can be added by hand; a slot is "received" once
 * a Document on the file is linked to it.
 */
export async function addRequiredDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const label = str(formData, "label");
  if (!id || !label) return;
  await withTenant(tenantId, async (tx) => {
    const max = await tx.transactionRequiredDocument.aggregate({
      where: { transactionId: id },
      _max: { sortOrder: true },
    });
    await tx.transactionRequiredDocument.create({
      data: { tenantId, transactionId: id, label, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
  });
  revalidatePath(`/dashboard/transactions/${id}`);
}

export async function removeRequiredDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const requiredId = str(formData, "requiredId");
  if (!id || !requiredId) return;
  await withTenant(tenantId, (tx) =>
    tx.transactionRequiredDocument.deleteMany({ where: { id: requiredId, transactionId: id } }),
  );
  revalidatePath(`/dashboard/transactions/${id}`);
}

/** Link (or, with an empty documentId, unlink) a document to a checklist slot. */
export async function setRequiredDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const requiredId = str(formData, "requiredId");
  if (!id || !requiredId) return;
  const documentId = optStr(formData, "documentId");
  await withTenant(tenantId, async (tx) => {
    // Only accept a document that actually lives on this transaction.
    if (documentId) {
      const doc = await tx.document.findFirst({
        where: { id: documentId, transactionId: id },
        select: { id: true },
      });
      if (!doc) return;
    }
    await tx.transactionRequiredDocument.updateMany({
      where: { id: requiredId, transactionId: id },
      data: { documentId },
    });
  });
  revalidatePath(`/dashboard/transactions/${id}`);
}

export async function deleteTransaction(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  const id = str(formData, "id");
  if (!id || !isAdmin || !confirmed(formData)) return;
  const gone = await withTenant(tenantId, (tx) =>
    tx.transaction.delete({ where: { id }, select: { propertyAddress: true } }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "transaction.deleted",
    summary: `Deleted transaction "${gone.propertyAddress}"`,
    subjectType: "transaction",
    subjectId: id,
  });
  revalidatePath("/dashboard/transactions");
  redirect("/dashboard/transactions");
}

/**
 * Domino recomputation: after a contract-governed date actually changes,
 * re-date every open plan task that still follows its anchor. Manually
 * re-dated tasks (dueDateEdited) and completed tasks are left alone.
 */
async function recomputeAnchoredTasks(
  tx: TenantTx,
  transactionId: string,
  anchors: { contractDate: Date | null; closeDate: Date | null },
): Promise<number> {
  const tasks = await tx.task.findMany({
    where: {
      transactionId,
      status: "OPEN",
      dueDateEdited: false,
      anchor: { not: null },
    },
    select: { id: true, anchor: true, offsetDays: true },
  });
  let moved = 0;
  for (const t of tasks) {
    const base = t.anchor === "CONTRACT_DATE" ? anchors.contractDate : anchors.closeDate;
    if (!base || t.offsetDays == null) continue;
    const due = new Date(base.getTime());
    due.setUTCDate(due.getUTCDate() + t.offsetDays);
    await tx.task.update({ where: { id: t.id }, data: { dueDate: due } });
    moved++;
  }
  return moved;
}

const GOVERNED_FIELDS = ["closeDate", "contractDate"] as const;
type GovernedField = (typeof GOVERNED_FIELDS)[number];
const FIELD_LABEL: Record<GovernedField, string> = {
  closeDate: "closing date",
  contractDate: "contract date",
};

/**
 * The contract is the source of truth: a governed date is never changed
 * directly. Proposing a change records the intent and creates a high-priority
 * task to get the amendment executed; only confirming applies the date and
 * fires the domino recomputation.
 */
export async function proposeDateChange(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const field = str(formData, "field") as GovernedField;
  const dateRaw = str(formData, "proposedDate");
  if (!id || !GOVERNED_FIELDS.includes(field) || !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return;

  await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { proposedDates: true },
    });
    const proposed = { ...((txn.proposedDates as Record<string, string> | null) ?? {}) };
    proposed[field] = dateRaw;
    await tx.transaction.update({ where: { id }, data: { proposedDates: proposed } });
    const existing = await tx.task.findFirst({
      where: { transactionId: id, proposedFor: field, status: "OPEN" },
      select: { id: true },
    });
    if (existing) {
      await tx.task.update({
        where: { id: existing.id },
        data: { title: `Amendment needed: ${FIELD_LABEL[field]} → ${dateRaw}` },
      });
    } else {
      await tx.task.create({
        data: {
          tenantId,
          transactionId: id,
          title: `Amendment needed: ${FIELD_LABEL[field]} → ${dateRaw}`,
          priority: "HIGH",
          proposedFor: field,
          dueDate: new Date(),
          assigneeId: session.user.id,
        },
      });
    }
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "transaction.date_proposed",
    summary: `Proposed ${FIELD_LABEL[field]} change to ${dateRaw}`,
    subjectType: "transaction",
    subjectId: id,
  });
  revalidatePath(`/dashboard/transactions/${id}`);
  revalidatePath("/dashboard");
}

/** Amendment executed: apply the proposed date and re-date anchored tasks. */
export async function confirmDateChange(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const field = str(formData, "field") as GovernedField;
  if (!id || !GOVERNED_FIELDS.includes(field)) return;

  let summary = "";
  await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { proposedDates: true },
    });
    const proposed = (txn.proposedDates as Record<string, string> | null) ?? {};
    const value = proposed[field];
    if (!value) return;
    const newDate = new Date(`${value}T00:00:00Z`);
    const rest = { ...proposed };
    delete rest[field];
    const updated = await tx.transaction.update({
      where: { id },
      data: { [field]: newDate, proposedDates: rest },
      select: { contractDate: true, closeDate: true },
    });
    const moved = await recomputeAnchoredTasks(tx, id, updated);
    await tx.task.updateMany({
      where: { transactionId: id, proposedFor: field, status: "OPEN" },
      data: { status: "DONE", completedAt: new Date() },
    });
    summary = `Confirmed ${FIELD_LABEL[field]} → ${value} (amendment executed); ${moved} task dates recomputed`;
  });
  if (summary) {
    logAudit({
      tenantId,
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "transaction.date_confirmed",
      summary,
      subjectType: "transaction",
      subjectId: id,
    });
  }
  revalidatePath(`/dashboard/transactions/${id}`);
  revalidatePath("/dashboard");
}

/** Withdraw a proposal: the contract stands as-is. */
export async function withdrawDateChange(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const field = str(formData, "field") as GovernedField;
  if (!id || !GOVERNED_FIELDS.includes(field)) return;
  await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { proposedDates: true },
    });
    const proposed = { ...((txn.proposedDates as Record<string, string> | null) ?? {}) };
    delete proposed[field];
    await tx.transaction.update({ where: { id }, data: { proposedDates: proposed } });
    await tx.task.updateMany({
      where: { transactionId: id, proposedFor: field, status: "OPEN" },
      data: { status: "SKIPPED" },
    });
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "transaction.date_withdrawn",
    summary: `Withdrew proposed ${FIELD_LABEL[field]} change`,
    subjectType: "transaction",
    subjectId: id,
  });
  revalidatePath(`/dashboard/transactions/${id}`);
  revalidatePath("/dashboard");
}
