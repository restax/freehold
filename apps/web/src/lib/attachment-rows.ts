import type { TenantTx } from "@freehold/db";

/** One row a template or plan wants on the file. */
export interface SeedItem {
  label: string;
  /** Optional items ride along on the list but never block or nag. */
  required?: boolean;
  /** Folder to file it under, matched by name and created if absent. */
  folderName?: string | null;
}

/**
 * Resolve folder names to ids for one transaction, creating any that don't
 * exist yet. Returns a name → id map, so a template naming the same folder on
 * ten rows creates it once.
 *
 * Names are matched case-insensitively but stored as the caller wrote them:
 * "contract files" and "Contract Files" are the same folder, and whichever
 * arrived first names it.
 */
export async function resolveFolders(
  tx: TenantTx,
  tenantId: string,
  transactionId: string,
  names: readonly string[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const byLower = new Map<string, string>();
  if (wanted.length === 0) return byLower;

  const existing = await tx.attachmentFolder.findMany({
    where: { transactionId },
    select: { id: true, name: true, sortOrder: true },
  });
  for (const f of existing) byLower.set(f.name.toLowerCase(), f.id);

  let next = Math.max(0, ...existing.map((f) => f.sortOrder)) + 1;
  for (const name of wanted) {
    if (byLower.has(name.toLowerCase())) continue;
    const created = await tx.attachmentFolder.create({
      data: { tenantId, transactionId, name, sortOrder: next++ },
      select: { id: true },
    });
    byLower.set(name.toLowerCase(), created.id);
  }
  return byLower;
}

/**
 * Seed expected-document rows from a template or action plan, skipping labels
 * the file already carries — applying a plan twice, or two plans that share a
 * document, shouldn't duplicate a row.
 *
 * Shared by `applyActionPlan` (plan-attached documents) and
 * `applyAttachmentTemplate` (standalone checklists), which both feed the same
 * table. Returns how many rows were actually added.
 */
export async function seedAttachmentRows(
  tx: TenantTx,
  tenantId: string,
  transactionId: string,
  items: readonly SeedItem[],
): Promise<number> {
  if (items.length === 0) return 0;

  const existing = await tx.transactionAttachment.findMany({
    where: { transactionId },
    select: { label: true, sortOrder: true },
  });
  const seen = new Set(existing.map((d) => d.label.toLowerCase()));
  const base = Math.max(0, ...existing.map((d) => d.sortOrder)) + 1;
  const toAdd = items.filter((i) => !seen.has(i.label.toLowerCase()));
  if (toAdd.length === 0) return 0;

  const folders = await resolveFolders(
    tx,
    tenantId,
    transactionId,
    toAdd.map((i) => i.folderName ?? "").filter(Boolean),
  );

  await tx.transactionAttachment.createMany({
    data: toAdd.map((item, i) => ({
      tenantId,
      transactionId,
      label: item.label,
      // A template row is something the file is waiting for unless it says
      // otherwise; that flag used to be dropped on the floor here.
      required: item.required ?? true,
      folderId: item.folderName
        ? (folders.get(item.folderName.trim().toLowerCase()) ?? null)
        : null,
      sortOrder: base + i,
    })),
  });
  return toAdd.length;
}

/**
 * Give a freshly uploaded file its own row, so the Attachments tab can be one
 * list rather than "the checklist" plus "the files nobody linked".
 *
 * Not required (nobody asked for it — it simply arrived) and complete on
 * arrival (the file is right there). Callers that upload *into* an existing
 * row link it there instead and never call this.
 */
export async function createRowForDocument(
  tx: TenantTx,
  args: {
    tenantId: string;
    transactionId: string;
    documentId: string;
    label: string;
    folderId?: string | null;
    createdById?: string | null;
    createdByName?: string | null;
  },
): Promise<void> {
  const max = await tx.transactionAttachment.aggregate({
    where: { transactionId: args.transactionId },
    _max: { sortOrder: true },
  });
  await tx.transactionAttachment.create({
    data: {
      tenantId: args.tenantId,
      transactionId: args.transactionId,
      documentId: args.documentId,
      label: args.label,
      folderId: args.folderId ?? null,
      required: false,
      completedAt: new Date(),
      createdById: args.createdById ?? null,
      createdByName: args.createdByName ?? null,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
}
