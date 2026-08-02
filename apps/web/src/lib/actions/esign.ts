"use server";

import { EnvelopeStatus, EsignProvider, withTenant } from "@freehold/db";
import { getEsignAdapter } from "@freehold/integrations";
import { revalidatePath } from "next/cache";
import { esignOverrides } from "@/lib/esign-config";
import { confirmed, str } from "@/lib/forms";
import { markEnvelopeSignaturesComplete, writeBackSignedCopy } from "@/lib/signature-sync";
import { getObjectBytes } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";
import { emitWebhook } from "@/lib/webhook-emit";

const PROVIDERS = Object.values(EsignProvider);

function tenantDefaultProvider(): EsignProvider {
  const v = process.env.FREEHOLD_ESIGN_DEFAULT as EsignProvider | undefined;
  return v && PROVIDERS.includes(v) ? v : EsignProvider.MANUAL;
}

/**
 * Send a document for signature. Provider resolution: the transaction's
 * client preference, else the tenant default (FREEHOLD_ESIGN_DEFAULT), else
 * MANUAL. Provider failures are recorded on the envelope row, never thrown.
 */
export async function sendForSignature(formData: FormData) {
  const { tenantId } = await requireTenant();
  const documentId = str(formData, "documentId");
  if (!documentId) return;

  const signers = [
    { name: str(formData, "signer1Name"), email: str(formData, "signer1Email") },
    { name: str(formData, "signer2Name"), email: str(formData, "signer2Email") },
  ].filter((s) => s.name && s.email);
  if (signers.length === 0) return;

  const { doc, provider } = await withTenant(tenantId, async (tx) => {
    const doc = await tx.document.findUniqueOrThrow({
      where: { id: documentId },
      select: {
        id: true,
        filename: true,
        data: true,
        storageKey: true,
        storageProvider: true,
        tenantId: true,
        transactionId: true,
        transaction: { select: { client: { select: { esignProvider: true } } } },
      },
    });
    return { doc, provider: doc.transaction.client?.esignProvider ?? tenantDefaultProvider() };
  });

  const envelope = await withTenant(tenantId, (tx) =>
    tx.signatureEnvelope.create({
      data: {
        tenantId,
        documentId: doc.id,
        transactionId: doc.transactionId,
        provider,
        signers,
      },
    }),
  );

  const adapter = getEsignAdapter(provider, await esignOverrides(tenantId, provider));
  const availability = adapter.available();
  try {
    if (!availability.ok) {
      throw new Error(`${adapter.label} is not configured. ${availability.reason ?? ""}`);
    }
    const pdf = await getObjectBytes(doc);
    const result = await adapter.createEnvelope({ title: doc.filename, pdf, signers });
    await withTenant(tenantId, (tx) =>
      tx.signatureEnvelope.update({
        where: { id: envelope.id },
        data: {
          status: EnvelopeStatus.SENT,
          externalId: result.externalId,
          sentAt: new Date(),
        },
      }),
    );
    await emitWebhook(tenantId, "envelope.sent", {
      id: envelope.id,
      transactionId: doc.transactionId,
      documentId: doc.id,
      filename: doc.filename,
      provider,
      signers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await withTenant(tenantId, (tx) =>
      tx.signatureEnvelope.update({
        where: { id: envelope.id },
        data: { status: EnvelopeStatus.ERROR, error: message.slice(0, 1000) },
      }),
    );
  }
  revalidatePath(`/dashboard/transactions/${doc.transactionId}`);
}

/** Poll the provider for current envelope status. */
export async function refreshEnvelope(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;

  const envelope = await withTenant(tenantId, (tx) =>
    tx.signatureEnvelope.findUniqueOrThrow({ where: { id } }),
  );
  if (!envelope.externalId || envelope.provider === EsignProvider.MANUAL) return;

  try {
    const adapter = getEsignAdapter(
      envelope.provider,
      await esignOverrides(tenantId, envelope.provider),
    );
    const result = await adapter.getStatus(envelope.externalId);
    await withTenant(tenantId, (tx) =>
      tx.signatureEnvelope.update({
        where: { id },
        data: {
          status: EnvelopeStatus[result.status],
          completedAt: result.status === "COMPLETED" ? new Date() : null,
          error: null,
        },
      }),
    );
    if (result.status === "COMPLETED") {
      // The row that carries this document now knows it is signed. Must run
      // before the write-back below: that repoints TransactionAttachment to
      // the new signed-copy Document, and this looks rows up by the old id.
      await markEnvelopeSignaturesComplete(tenantId, envelope.transactionId, envelope.documentId);
      // OpenSign hands back a fetchable signed copy; other providers don't.
      if (result.signedFileUrl) {
        await writeBackSignedCopy(
          tenantId,
          envelope.transactionId,
          envelope.documentId,
          envelope.id,
          result.signedFileUrl,
        ).catch(() => {});
      }
      await emitWebhook(tenantId, "envelope.completed", {
        id: envelope.id,
        transactionId: envelope.transactionId,
        documentId: envelope.documentId,
        provider: envelope.provider,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await withTenant(tenantId, (tx) =>
      tx.signatureEnvelope.update({
        where: { id },
        data: { error: message.slice(0, 1000) },
      }),
    );
  }
  revalidatePath(`/dashboard/transactions/${envelope.transactionId}`);
}

/** MANUAL provider only: the user confirms signatures were collected. */
export async function markEnvelopeSigned(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  const envelope = await withTenant(tenantId, async (tx) => {
    const env = await tx.signatureEnvelope.findUniqueOrThrow({ where: { id } });
    if (env.provider !== EsignProvider.MANUAL) return env;
    return tx.signatureEnvelope.update({
      where: { id },
      data: { status: EnvelopeStatus.COMPLETED, completedAt: new Date() },
    });
  });
  await markEnvelopeSignaturesComplete(tenantId, envelope.transactionId, envelope.documentId);
  await emitWebhook(tenantId, "envelope.completed", {
    id: envelope.id,
    transactionId: envelope.transactionId,
    documentId: envelope.documentId,
    provider: envelope.provider,
  });
  revalidatePath(`/dashboard/transactions/${envelope.transactionId}`);
}

export async function deleteEnvelope(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id || !confirmed(formData)) return;
  await withTenant(tenantId, (tx) => tx.signatureEnvelope.delete({ where: { id } }));
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
