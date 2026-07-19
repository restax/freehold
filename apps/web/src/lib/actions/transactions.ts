"use server";

import { TransactionSide, TransactionStatus, withTenant } from "@freehold/db";
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
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  const propertyAddress = str(formData, "propertyAddress");
  await withTenant(tenantId, (tx) =>
    tx.transaction.update({
      where: { id },
      data: {
        ...(propertyAddress ? { propertyAddress } : {}),
        ...commonFields(formData),
      },
    }),
  );
  revalidatePath(`/dashboard/transactions/${id}`);
  revalidatePath("/dashboard/transactions");
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
