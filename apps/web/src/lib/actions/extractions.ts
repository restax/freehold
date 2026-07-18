"use server";

import { ExtractionStatus, FieldTarget, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flattenExtraction, transactionUpdateFor } from "@/lib/ai/contract-schema";
import { EXTRACTION_MODEL, extractContract } from "@/lib/ai/extract";
import { str } from "@/lib/forms";
import { getObjectBytes } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";

/**
 * Run Claude over an uploaded contract PDF. Synchronous for now (the browser
 * waits on the form POST; ~30–90s) — moves to a BullMQ job when the queue
 * layer lands. Failures are recorded on the extraction row, never thrown at
 * the user.
 */
export async function runExtraction(formData: FormData) {
  const { tenantId } = await requireTenant();
  const documentId = str(formData, "documentId");
  if (!documentId) return;

  const created = await withTenant(tenantId, async (tx) => {
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

  const { extraction, doc } = created;
  try {
    const result = await extractContract(await getObjectBytes(doc));
    const rows = flattenExtraction(result);
    await withTenant(tenantId, async (tx) => {
      await tx.extractionField.createMany({
        data: rows.map((r) => ({
          tenantId,
          extractionId: extraction.id,
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
        where: { id: extraction.id },
        data: { status: ExtractionStatus.READY },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await withTenant(tenantId, (tx) =>
      tx.contractExtraction.update({
        where: { id: extraction.id },
        data: { status: ExtractionStatus.FAILED, error: message.slice(0, 1000) },
      }),
    );
  }

  revalidatePath(`/dashboard/transactions/${doc.transactionId}`);
  redirect(`/dashboard/transactions/${doc.transactionId}/extractions/${extraction.id}`);
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
