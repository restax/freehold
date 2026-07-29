"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";
import { normalizeColumnSelection } from "@/lib/transaction-columns";

/**
 * Save this person's transactions-table columns for this workspace.
 *
 * Written to their own member row, so one coordinator's layout never
 * changes anyone else's — and a person in two workspaces keeps a separate
 * layout in each. The submitted list is normalized first: unknown keys
 * dropped, duplicates collapsed, the locked column forced back in, an empty
 * submission reset to defaults. A hand-posted form can't produce a table
 * with no columns.
 */
export async function saveTransactionColumns(formData: FormData) {
  const { tenantId, userId } = await requireTenant({ allowGuest: true });
  const submitted = formData.getAll("columns").map(String);
  const columns = normalizeColumnSelection(submitted);

  const member = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId },
    select: { id: true, tablePrefs: true },
  });
  if (!member) return;

  const current = (member.tablePrefs ?? {}) as Record<string, unknown>;
  await prisma.member.update({
    where: { id: member.id },
    // Merge rather than replace: this row will hold other tables' prefs too.
    data: { tablePrefs: { ...current, transactionColumns: columns } },
  });
  revalidatePath("/dashboard/transactions");
}
