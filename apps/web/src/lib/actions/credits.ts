"use server";

import { revalidatePath } from "next/cache";
import { str } from "@/lib/forms";
import { spendCreditForTransaction } from "@/lib/plans";
import { requireTenant } from "@/lib/tenant";

/**
 * Spend one AI credit to permanently turn on pro features for a transaction.
 * The button that posts here is only rendered when the workspace has a credit
 * to spend; the spend itself is atomic and idempotent, so a stray double click
 * (or a race) can never over-charge. Paid plans never reach this — their AI is
 * always on.
 */
export async function enableProFeatures(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  if (!transactionId) return;
  await spendCreditForTransaction(tenantId, transactionId, userId);
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
