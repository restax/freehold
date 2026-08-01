"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import { logActivity } from "@/lib/activity";
import { createRowForDocument } from "@/lib/attachment-rows";
import { optStr, str } from "@/lib/forms";
import { planSplits, type SplitSpec, splitFilename } from "@/lib/pdf-split";
import { deleteObject, getObjectBytes, putObject } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";

/**
 * Carving one PDF into several, and gluing several into one.
 *
 * Both run on the server rather than in the browser. The bytes already live in
 * our storage, so a client-side split would mean downloading the whole file,
 * splitting it, and uploading each part back — three trips and a second
 * authorisation path — to save a few hundred milliseconds of Node time on a
 * file capped at 10 MB. pdf-lib runs the same either way.
 */

const MAX_SPLITS = 20;

/** Read the stored bytes for a document, whichever driver holds them. */
async function loadPdf(tenantId: string, documentId: string, transactionId: string) {
  return withTenant(tenantId, (tx) =>
    tx.document.findFirst({
      where: { id: documentId, transactionId, contentType: "application/pdf" },
      select: {
        id: true,
        filename: true,
        data: true,
        storageKey: true,
        storageProvider: true,
        tenantId: true,
        visibleToAgent: true,
        visibleToClient: true,
      },
    }),
  );
}

/**
 * Split a PDF into new documents, one per page range, each landing on its own
 * row in the Attachments tab.
 *
 * Ranges are validated as a set before anything is written (see planSplits):
 * if any of them is wrong, nothing is created. Half-carving a document and
 * reporting an error afterwards leaves no way to tell which parts are real.
 */
export async function splitDocument(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const documentId = str(formData, "documentId");
  if (!transactionId || !documentId) return;

  // Parallel arrays out of the repeatable rows in the dialog.
  const names = formData.getAll("splitName").map(String);
  const froms = formData.getAll("splitFrom").map(String);
  const tos = formData.getAll("splitTo").map(String);
  const folders = formData.getAll("splitFolder").map(String);
  const specs: SplitSpec[] = names.slice(0, MAX_SPLITS).map((name, i) => ({
    name,
    from: Number(froms[i]),
    to: Number(tos[i]),
    folderId: folders[i] || null,
  }));

  const source = await loadPdf(tenantId, documentId, transactionId);
  if (!source) return;

  const bytes = await getObjectBytes(source);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const { splits, errors } = planSplits(specs, pdf.getPageCount());
  if (errors.length > 0 || splits.length === 0) {
    // Back to the tab with the problems named, the way createTransaction
    // returns a licence gap — the ranges are worth correcting, not retyping.
    redirect(
      `/dashboard/transactions/${transactionId}?tab=documents&splitError=${encodeURIComponent(
        errors.join(" ") || "Nothing to split.",
      )}`,
    );
  }

  const dropOriginal = str(formData, "deleteOriginal") === "on";
  const uploaderName = session.user.name ?? session.user.email;

  for (const split of splits) {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(pdf, split.pageIndices);
    for (const page of pages) out.addPage(page);
    const outBytes = Buffer.from(await out.save());
    const filename = splitFilename(split.name);
    const stored = await putObject(tenantId, filename, outBytes, "application/pdf");

    await withTenant(tenantId, async (tx) => {
      const doc = await tx.document.create({
        data: {
          tenantId,
          transactionId,
          filename,
          contentType: "application/pdf",
          sizeBytes: outBytes.length,
          data: stored.data,
          storageKey: stored.storageKey,
          storageProvider: stored.storageProvider,
          // A piece of a document is exactly as private as the whole was.
          visibleToAgent: source.visibleToAgent,
          visibleToClient: source.visibleToClient,
          uploadedById: session.user.id,
          uploadedByName: uploaderName,
        },
      });
      await createRowForDocument(tx, {
        tenantId,
        transactionId,
        documentId: doc.id,
        label: filename,
        folderId: split.folderId ?? null,
        createdById: session.user.id,
        createdByName: uploaderName,
      });
    });
  }

  if (dropOriginal) {
    // Only once every part is safely written — losing the source to a failure
    // halfway through would be unrecoverable.
    await withTenant(tenantId, async (tx) => {
      await tx.transactionAttachment.updateMany({
        where: { documentId: source.id, transactionId },
        data: { documentId: null, completedAt: null },
      });
      await tx.document.deleteMany({ where: { id: source.id } });
    });
    await deleteObject({
      storageKey: source.storageKey,
      data: null,
      storageProvider: source.storageProvider,
      tenantId: source.tenantId,
    });
  }

  logActivity({
    tenantId,
    transactionId,
    actor: session.user,
    action: "document.split",
    summary: `Split ${source.filename} into ${splits.length} file${
      splits.length === 1 ? "" : "s"
    }${dropOriginal ? " and removed the original" : ""}`,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/**
 * Glue several PDFs into one, in the order the list showed them.
 *
 * The sources are left alone: combining is usually about producing a package
 * to send, not about discarding what it was made from.
 */
export async function combineDocuments(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const ids = formData.getAll("documentIds").map(String).filter(Boolean);
  if (!transactionId || ids.length < 2) return;

  const name = optStr(formData, "name") ?? "Combined";
  const folderId = optStr(formData, "folderId");

  const sources = await withTenant(tenantId, (tx) =>
    tx.document.findMany({
      where: { id: { in: ids }, transactionId, contentType: "application/pdf" },
      select: {
        id: true,
        filename: true,
        data: true,
        storageKey: true,
        storageProvider: true,
        tenantId: true,
        visibleToAgent: true,
        visibleToClient: true,
      },
    }),
  );
  if (sources.length < 2) return;
  // findMany returns rows in its own order; the person picked an order.
  const byId = new Map(sources.map((d) => [d.id, d]));
  const ordered = ids.map((id) => byId.get(id)).filter((d): d is NonNullable<typeof d> => !!d);

  const out = await PDFDocument.create();
  for (const src of ordered) {
    const pdf = await PDFDocument.load(await getObjectBytes(src), { ignoreEncryption: true });
    const pages = await out.copyPages(pdf, pdf.getPageIndices());
    for (const page of pages) out.addPage(page);
  }
  const outBytes = Buffer.from(await out.save());
  const filename = splitFilename(name);
  const stored = await putObject(tenantId, filename, outBytes, "application/pdf");
  const uploaderName = session.user.name ?? session.user.email;

  await withTenant(tenantId, async (tx) => {
    const doc = await tx.document.create({
      data: {
        tenantId,
        transactionId,
        filename,
        contentType: "application/pdf",
        sizeBytes: outBytes.length,
        data: stored.data,
        storageKey: stored.storageKey,
        storageProvider: stored.storageProvider,
        // The combination is only as shareable as its least shareable part.
        visibleToAgent: ordered.every((d) => d.visibleToAgent),
        visibleToClient: ordered.every((d) => d.visibleToClient),
        uploadedById: session.user.id,
        uploadedByName: uploaderName,
      },
    });
    await createRowForDocument(tx, {
      tenantId,
      transactionId,
      documentId: doc.id,
      label: filename,
      folderId,
      createdById: session.user.id,
      createdByName: uploaderName,
    });
  });

  logActivity({
    tenantId,
    transactionId,
    actor: session.user,
    action: "document.combined",
    summary: `Combined ${ordered.length} files into ${filename}`,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
