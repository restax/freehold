"use server";

import { TransactionSide, TransactionStatus, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dateOnly, intOr, oneOf, optStr, str } from "@/lib/forms";
import { requireTenant } from "@/lib/tenant";

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
    notes: optStr(formData, "notes"),
  };
}

export async function createTransaction(formData: FormData) {
  const { tenantId } = await requireTenant();
  const propertyAddress = str(formData, "propertyAddress");
  if (!propertyAddress) return;
  const created = await withTenant(tenantId, (tx) =>
    tx.transaction.create({
      data: { tenantId, propertyAddress, ...commonFields(formData) },
    }),
  );
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
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.transaction.delete({ where: { id } }));
  revalidatePath("/dashboard/transactions");
  redirect("/dashboard/transactions");
}
