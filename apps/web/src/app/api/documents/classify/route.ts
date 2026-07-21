import { withTenant } from "@freehold/db";
import { NextResponse } from "next/server";
import { classifyDocument } from "@/lib/ai/classify";
import { putObject } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";
import { emitWebhook } from "@/lib/webhook-emit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * The drag-and-drop uploader's endpoint. Stores the dropped PDF on the
 * transaction, then asks the model what it is and which required-documents slot
 * it fills, returning that as a suggestion the coordinator confirms in the
 * popover. Classification is best-effort: if the AI is unconfigured or errors,
 * the file is still saved and we just return no suggestion.
 */
export async function POST(req: Request) {
  const { tenantId } = await requireTenant();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const transactionId = String(form?.get("transactionId") ?? "");
  if (!transactionId || !(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = file.name || "document.pdf";
  const contentType = file.type || "application/pdf";

  // The transaction must belong to this tenant; store the bytes and the row.
  const { document, missingSlots } = await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true },
    });
    if (!txn) return { document: null, missingSlots: [] as { id: string; label: string }[] };

    const stored = await putObject(tenantId, filename, bytes, contentType);
    const document = await tx.document.create({
      data: {
        tenantId,
        transactionId,
        filename,
        contentType,
        sizeBytes: file.size,
        data: stored.data,
        storageKey: stored.storageKey,
        storageProvider: stored.storageProvider,
      },
      select: { id: true },
    });
    const missing = await tx.transactionRequiredDocument.findMany({
      where: { transactionId, documentId: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true },
    });
    return { document, missingSlots: missing };
  });

  if (!document) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await emitWebhook(tenantId, "document.uploaded", {
    id: document.id,
    transactionId,
    filename,
    contentType,
    sizeBytes: file.size,
  });

  // Best-effort classification against the missing slots.
  let docType: string | null = null;
  let suggestedRequiredId: string | null = null;
  if (contentType === "application/pdf" && process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await classifyDocument(
        bytes,
        missingSlots.map((s) => s.label),
      );
      docType = result.docType || null;
      if (result.matchIndex != null) {
        suggestedRequiredId = missingSlots[result.matchIndex]?.id ?? null;
      }
    } catch {
      // Leave the suggestion empty — the file is already saved.
    }
  }

  return NextResponse.json({
    documentId: document.id,
    filename,
    docType,
    suggestedRequiredId,
    missingSlots,
  });
}
