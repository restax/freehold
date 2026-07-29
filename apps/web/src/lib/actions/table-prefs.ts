"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { normalizeContactColumns } from "@/lib/contact-columns";
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
  await saveColumns(formData, "transactionColumns", normalizeColumnSelection, [
    "/dashboard/transactions",
  ]);
}

/** The same, for the contacts list. */
export async function saveContactColumns(formData: FormData) {
  await saveColumns(formData, "contactColumns", normalizeContactColumns, ["/dashboard/contacts"]);
}

/**
 * Write one table's column preference onto this person's member row.
 *
 * Shared because both lists want identical behaviour and the merge below is
 * the part that matters: tablePrefs holds every table's layout, so writing one
 * must not drop the others.
 */
async function saveColumns(
  formData: FormData,
  prefKey: string,
  normalize: (keys: readonly string[]) => string[],
  revalidate: string[],
) {
  const { tenantId, userId } = await requireTenant({ allowGuest: true });
  const submitted = formData.getAll("columns").map(String);
  const columns = normalize(submitted);

  const member = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId },
    select: { id: true, tablePrefs: true },
  });
  if (!member) return;

  // Every table's preference is a list of column keys, so the merged blob
  // stays a plain JSON object Prisma will accept.
  const current = (member.tablePrefs ?? {}) as Record<string, string[]>;
  await prisma.member.update({
    where: { id: member.id },
    // Merge rather than replace: this row will hold other tables' prefs too.
    data: { tablePrefs: { ...current, [prefKey]: columns } },
  });
  for (const path of revalidate) revalidatePath(path);
}
