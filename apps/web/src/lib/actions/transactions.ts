"use server";

import { type TenantTx, TransactionSide, TransactionStatus, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { confirmed, dateOnly, intOr, oneOf, optStr, str } from "@/lib/forms";
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
    listPrice: intOr(formData, "listPrice"),
    listDate: dateOnly(formData, "listDate"),
    onMarketDate: dateOnly(formData, "onMarketDate"),
    expireDate: dateOnly(formData, "expireDate"),
    mlsId: optStr(formData, "mlsId"),
    coAgentClientId: optStr(formData, "coAgentClientId"),
    tc1UserId: optStr(formData, "tc1UserId"),
    tc2UserId: optStr(formData, "tc2UserId"),
    notes: optStr(formData, "notes"),
  };
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
  const { tenantId } = await requireTenant();
  const propertyAddress = str(formData, "propertyAddress");
  if (!propertyAddress) return;
  const limit = await transactionLimit(tenantId);
  if (limit.limited) return; // cloud free-tier cap; the page shows the upgrade banner
  const created = await withTenant(tenantId, (tx) =>
    tx.transaction.create({
      data: { tenantId, propertyAddress, ...commonFields(formData) },
    }),
  );
  await emitWebhook(tenantId, "transaction.created", {
    id: created.id,
    propertyAddress: created.propertyAddress,
    status: created.status,
    side: created.side,
  });
  revalidatePath("/dashboard/transactions");
  redirect(`/dashboard/transactions/${created.id}`);
}

export async function updateTransaction(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  const propertyAddress = str(formData, "propertyAddress");
  const fields = commonFields(formData);

  const redirected: string[] = [];
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { contractDate: true, closeDate: true, proposedDates: true },
    });

    // The contract is the source of truth: once a governed date exists,
    // editing it in the form becomes a proposal (amendment to-do), never a
    // silent change. First-time entry (null → value) applies directly and
    // dates the anchored tasks.
    const data: Record<string, unknown> = {
      ...(propertyAddress ? { propertyAddress } : {}),
      ...fields,
    };
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
