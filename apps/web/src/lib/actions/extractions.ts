"use server";

import { ExtractionStatus, FieldTarget, TransactionStatus, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flattenExtraction, transactionUpdateFor } from "@/lib/ai/contract-schema";
import { EXTRACTION_MODEL, extractContract } from "@/lib/ai/extract";
import { str } from "@/lib/forms";
import { extractionCreditState, recordExtractionUse, transactionLimit } from "@/lib/plans";
import { getObjectBytes, putObject, type StoredBytes } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";
import { emitWebhook } from "@/lib/webhook-emit";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB, matching document upload

/** A filename like "412-maple_purchase-agreement.pdf" → a readable, provisional title. */
function provisionalAddress(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return base ? base.slice(0, 120) : "Uploaded contract";
}

/**
 * Run Claude over a RUNNING extraction's document, write the field rows, and
 * flip the row READY (or FAILED). Shared by the transaction-first path
 * (runExtraction) and the upload-first path (createFromContract). Synchronous
 * for now (the browser waits on the POST; ~30–90s) — moves to a BullMQ job
 * when the queue layer lands. Never throws: failures land on the row.
 */
async function completeExtraction(
  tenantId: string,
  extractionId: string,
  doc: StoredBytes,
  consumeCredit: boolean,
): Promise<void> {
  try {
    const result = await extractContract(await getObjectBytes(doc));
    const rows = flattenExtraction(result);
    await withTenant(tenantId, async (tx) => {
      await tx.extractionField.createMany({
        data: rows.map((r) => ({
          tenantId,
          extractionId,
          key: r.key,
          label: r.label,
          value: r.value,
          valueType: r.valueType,
          page: r.page,
          quote: r.quote,
          confidence: r.confidence,
          target: r.target,
          sortOrder: r.sortOrder,
        })),
      });
      await tx.contractExtraction.update({
        where: { id: extractionId },
        data: { status: ExtractionStatus.READY },
      });
    });
    // Credits are consumed only on success — a failed run costs nothing.
    if (consumeCredit) await recordExtractionUse(tenantId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await withTenant(tenantId, (tx) =>
      tx.contractExtraction.update({
        where: { id: extractionId },
        data: { status: ExtractionStatus.FAILED, error: message.slice(0, 1000) },
      }),
    );
  }
}

/** Run extraction over a contract already attached to a transaction. */
export async function runExtraction(formData: FormData) {
  const { tenantId } = await requireTenant();
  const documentId = str(formData, "documentId");
  if (!documentId) return;

  // Free-tier trial credits (Cloud only). The page hides the button when
  // exhausted; this is the enforcement either way.
  const credits = await extractionCreditState(tenantId);
  if (credits.limited) return;

  const { extraction, doc } = await withTenant(tenantId, async (tx) => {
    const doc = await tx.document.findUniqueOrThrow({
      where: { id: documentId },
      select: { id: true, transactionId: true, data: true, storageKey: true, contentType: true },
    });
    const extraction = await tx.contractExtraction.create({
      data: {
        tenantId,
        documentId: doc.id,
        transactionId: doc.transactionId,
        model: EXTRACTION_MODEL,
        status: ExtractionStatus.RUNNING,
      },
    });
    return { extraction, doc };
  });

  await completeExtraction(tenantId, extraction.id, doc, credits.limit != null);

  revalidatePath(`/dashboard/transactions/${doc.transactionId}`);
  redirect(`/dashboard/transactions/${doc.transactionId}/extractions/${extraction.id}`);
}

/**
 * Upload-first create: a signed contract PDF becomes a new transaction with no
 * manual typing. We create a provisional transaction (named from the file),
 * store + attach the PDF, run extraction, and land the reviewer on the
 * citation screen — where confirming applies the real address, price, dates,
 * and deadline tasks. Nothing but the placeholder title exists until they apply.
 */
export async function createFromContract(formData: FormData) {
  const { tenantId } = await requireTenant();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return;

  // Same two gates as the manual create + the extract button: plan cap first
  // (never strand an upload against a full plan), then trial credits.
  const [limit, credits] = await Promise.all([
    transactionLimit(tenantId),
    extractionCreditState(tenantId),
  ]);
  if (limit.limited || credits.limited) redirect("/dashboard/transactions");

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = file.name || "contract.pdf";
  const contentType = file.type || "application/pdf";
  const stored = await putObject(tenantId, filename, bytes, contentType);

  const { transaction, extraction, doc } = await withTenant(tenantId, async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        tenantId,
        propertyAddress: provisionalAddress(filename),
        status: TransactionStatus.UNDER_CONTRACT,
      },
      select: { id: true },
    });
    const doc = await tx.document.create({
      data: {
        tenantId,
        transactionId: transaction.id,
        filename,
        contentType,
        sizeBytes: file.size,
        data: stored.data,
        storageKey: stored.storageKey,
      },
      select: { id: true, data: true, storageKey: true },
    });
    const extraction = await tx.contractExtraction.create({
      data: {
        tenantId,
        documentId: doc.id,
        transactionId: transaction.id,
        model: EXTRACTION_MODEL,
        status: ExtractionStatus.RUNNING,
      },
      select: { id: true },
    });
    return { transaction, extraction, doc };
  });

  await emitWebhook(tenantId, "document.uploaded", {
    id: doc.id,
    transactionId: transaction.id,
    filename,
    contentType,
    sizeBytes: file.size,
  });

  await completeExtraction(tenantId, extraction.id, doc, credits.limit != null);

  revalidatePath("/dashboard/transactions");
  redirect(`/dashboard/transactions/${transaction.id}/extractions/${extraction.id}`);
}

/**
 * Apply the reviewer's selected fields to the transaction: columns update,
 * deadlines become dated tasks, everything else lands in custom fields.
 */
export async function applyExtraction(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  const extractionId = str(formData, "extractionId");
  if (!extractionId) return;
  const selectedIds = formData.getAll("fieldIds").map(String);

  const transactionId = await withTenant(tenantId, async (tx) => {
    const extraction = await tx.contractExtraction.findUniqueOrThrow({
      where: { id: extractionId },
      include: { fields: true, transaction: { select: { id: true, customFields: true } } },
    });
    const chosen = extraction.fields.filter((f) => selectedIds.includes(f.id));

    const columnUpdates: Record<string, unknown> = {};
    const customFields = {
      ...((extraction.transaction.customFields as Record<string, string> | null) ?? {}),
    };
    let maxSort = 0;

    for (const field of chosen) {
      if (field.target === FieldTarget.TRANSACTION_FIELD) {
        const fragment = transactionUpdateFor(field.key, field.value);
        if (fragment) Object.assign(columnUpdates, fragment);
        else customFields[field.label] = field.value; // unparseable → still captured
      } else if (field.target === FieldTarget.CUSTOM_FIELD) {
        customFields[field.label] = field.value;
      }
    }

    const taskFields = chosen.filter((f) => f.target === FieldTarget.TASK);
    if (taskFields.length > 0) {
      const agg = await tx.task.aggregate({
        where: { transactionId: extraction.transactionId },
        _max: { sortOrder: true },
      });
      maxSort = agg._max.sortOrder ?? 0;
      await tx.task.createMany({
        data: taskFields.map((f, i) => {
          const due = /^\d{4}-\d{2}-\d{2}$/.test(f.value)
            ? new Date(`${f.value}T00:00:00.000Z`)
            : null;
          return {
            tenantId,
            transactionId: extraction.transactionId,
            title: `${f.label} (from contract)`,
            dueDate: due,
            sortOrder: maxSort + i + 1,
            assigneeId: userId,
          };
        }),
      });
    }

    await tx.transaction.update({
      where: { id: extraction.transactionId },
      data: { ...columnUpdates, customFields },
    });
    await tx.extractionField.updateMany({
      where: { id: { in: chosen.map((f) => f.id) } },
      data: { applied: true },
    });
    await tx.contractExtraction.update({
      where: { id: extractionId },
      data: { status: ExtractionStatus.APPLIED },
    });
    return extraction.transactionId;
  });

  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard");
  redirect(`/dashboard/transactions/${transactionId}`);
}

export async function discardExtraction(formData: FormData) {
  const { tenantId } = await requireTenant();
  const extractionId = str(formData, "extractionId");
  const transactionId = str(formData, "transactionId");
  if (!extractionId) return;
  await withTenant(tenantId, (tx) => tx.contractExtraction.delete({ where: { id: extractionId } }));
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  redirect(`/dashboard/transactions/${transactionId}`);
}
