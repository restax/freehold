import { ExtractionStatus, prisma, withTenant } from "@freehold/db";
import { flattenExtraction } from "@/lib/ai/contract-schema";
import { EXTRACTION_MODEL, extractContract } from "@/lib/ai/extract";
import { logAiUsage, resolveModel } from "@/lib/ai/usage";
import { getObjectBytes, type StoredBytes } from "@/lib/storage";

/**
 * Running one contract extraction, separate from the actions that start one.
 *
 * This lives outside the "use server" module on purpose: three callers now
 * need it — the transaction-first path, the upload-first path, and intake
 * conversion — and in a server-action file every export becomes an endpoint
 * the browser can call. `completeExtraction` takes a tenantId, so that would
 * be an endpoint for reading another workspace's contracts.
 */

/** The contract-extraction model for a tenant: an operator override, else default. */
export async function extractionModel(tenantId: string): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { aiModelOverride: true },
  });
  return resolveModel(org?.aiModelOverride, EXTRACTION_MODEL);
}

/**
 * Run Claude over a RUNNING extraction's document, write the field rows, and
 * flip the row READY (or FAILED). Synchronous for now (~30–90s) — moves to a
 * BullMQ job when the queue layer lands. Never throws: failures land on the
 * row, because both the interactive callers and the after() caller have
 * nowhere useful to put an exception.
 */
export async function completeExtraction(
  tenantId: string,
  extractionId: string,
  doc: StoredBytes,
  model: string,
  transactionId: string,
): Promise<void> {
  try {
    const { result, usage } = await extractContract(await getObjectBytes(doc), model);
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
    // Record token usage for operator cost visibility (best-effort).
    await logAiUsage(tenantId, "extract", usage, transactionId);
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
