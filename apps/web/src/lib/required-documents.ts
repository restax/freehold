import type { TenantTx } from "@freehold/db";

/**
 * Seed the required-documents checklist from a set of labels, skipping ones
 * the file already lists — applying an action plan twice, or two plans that
 * share a document, shouldn't duplicate a slot. Shared by `applyActionPlan`
 * (plan-attached documents) and `applyAttachmentTemplate` (standalone
 * checklists), which both feed the same table.
 */
export async function seedRequiredDocuments(
  tx: TenantTx,
  tenantId: string,
  transactionId: string,
  labels: readonly string[],
): Promise<number> {
  if (labels.length === 0) return 0;
  const existing = await tx.transactionRequiredDocument.findMany({
    where: { transactionId },
    select: { label: true, sortOrder: true },
  });
  const seen = new Set(existing.map((d) => d.label.toLowerCase()));
  const base = Math.max(0, ...existing.map((d) => d.sortOrder)) + 1;
  const toAdd = labels.filter((label) => !seen.has(label.toLowerCase()));
  if (toAdd.length === 0) return 0;
  await tx.transactionRequiredDocument.createMany({
    data: toAdd.map((label, i) => ({
      tenantId,
      transactionId,
      label,
      sortOrder: base + i,
    })),
  });
  return toAdd.length;
}
