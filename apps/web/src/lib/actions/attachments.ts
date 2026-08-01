"use server";

import { Prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveFolders } from "@/lib/attachment-rows";
import { linkLabel, safeExternalUrl } from "@/lib/attachments";
import { optStr, str } from "@/lib/forms";
import {
  pruneSignatures,
  readSignatureState,
  signAll,
  signerParties,
  toggleSigner,
} from "@/lib/signature-tracking";
import { requireTenant } from "@/lib/tenant";

/**
 * Everything that edits the Attachments tab.
 *
 * A row is the unit and the file is optional (see TransactionAttachment in the
 * schema), so most of these change what a row *means* — expected, satisfied,
 * not applicable, filed here — rather than moving bytes around.
 */

function revalidateTxn(transactionId: string) {
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/**
 * Add a row by name — a document the file is waiting for, with nothing
 * attached yet. Rows also arrive from action plans and attachment templates
 * (seedAttachmentRows) and from uploads (createRowForDocument); this is the
 * by-hand path.
 */
export async function addAttachmentRow(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const label = str(formData, "label");
  if (!id || !label) return;
  const folderId = optStr(formData, "folderId");
  await withTenant(tenantId, async (tx) => {
    const max = await tx.transactionAttachment.aggregate({
      where: { transactionId: id },
      _max: { sortOrder: true },
    });
    await tx.transactionAttachment.create({
      data: {
        tenantId,
        transactionId: id,
        label,
        folderId: folderId
          ? ((
              await tx.attachmentFolder.findFirst({
                where: { id: folderId, transactionId: id },
                select: { id: true },
              })
            )?.id ?? null)
          : null,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
        createdById: session.user.id,
        createdByName: session.user.name ?? session.user.email,
      },
    });
  });
  revalidateTxn(id);
}

/**
 * Add rows for things that live somewhere else — a Dropbox folder of photos,
 * a county recorder page, a survey on the surveyor's own portal.
 *
 * One link per line, because a coordinator pasting from an email has several
 * at once and typing them into one field each is the kind of friction that
 * stops people recording them at all. A line may be "Label | url" or just a
 * url, in which case the host stands in as the label.
 */
export async function addAttachmentWebLinks(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  const folderId = optStr(formData, "folderId");

  const parsed: { label: string; url: string }[] = [];
  for (const line of str(formData, "links").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // "Label | url" splits on the last bar so a label may contain one.
    const bar = trimmed.lastIndexOf("|");
    const rawUrl = bar === -1 ? trimmed : trimmed.slice(bar + 1);
    const rawLabel = bar === -1 ? "" : trimmed.slice(0, bar).trim();
    const url = safeExternalUrl(rawUrl);
    if (!url) continue;
    parsed.push({ label: rawLabel || linkLabel(url), url });
  }
  if (parsed.length === 0) return;

  await withTenant(tenantId, async (tx) => {
    const folder = folderId
      ? await tx.attachmentFolder.findFirst({
          where: { id: folderId, transactionId: id },
          select: { id: true },
        })
      : null;
    const max = await tx.transactionAttachment.aggregate({
      where: { transactionId: id },
      _max: { sortOrder: true },
    });
    let sortOrder = max._max.sortOrder ?? 0;
    await tx.transactionAttachment.createMany({
      data: parsed.map(({ label, url }) => ({
        tenantId,
        transactionId: id,
        label,
        webUrl: url,
        folderId: folder?.id ?? null,
        // A link is the thing itself, not a promise of one — nothing is
        // outstanding once it's recorded.
        required: false,
        completedAt: new Date(),
        sortOrder: ++sortOrder,
        createdById: session.user.id,
        createdByName: session.user.name ?? session.user.email,
      })),
    });
  });
  revalidateTxn(id);
}

/**
 * Put a link on an existing row, or (with an empty url) take it off.
 *
 * Separate from the add path because the common case is a row that already
 * exists — "Survey" is on the checklist and the surveyor sent a portal link
 * instead of a PDF.
 */
export async function setAttachmentWebUrl(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowId = str(formData, "rowId");
  if (!id || !rowId) return;
  const raw = optStr(formData, "webUrl");
  // A url that fails validation clears nothing: silently blanking the field
  // because of a typo would lose the link that was already there.
  const url = raw === null ? null : safeExternalUrl(raw);
  if (raw !== null && !url) return;
  await withTenant(tenantId, (tx) =>
    tx.transactionAttachment.updateMany({
      where: { id: rowId, transactionId: id },
      data: { webUrl: url },
    }),
  );
  revalidateTxn(id);
}

/**
 * Rename a row. The label is what the checklist reads as, and rows arrive
 * named by whatever produced them — a template's wording, or a filename like
 * "scan_0142.pdf" that says nothing about what the document is.
 */
export async function renameAttachmentRow(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowId = str(formData, "rowId");
  const label = str(formData, "label");
  if (!id || !rowId || !label) return;
  await withTenant(tenantId, (tx) =>
    tx.transactionAttachment.updateMany({
      where: { id: rowId, transactionId: id },
      data: { label },
    }),
  );
  revalidateTxn(id);
}

export async function removeAttachmentRow(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowId = str(formData, "rowId");
  if (!id || !rowId) return;
  await withTenant(tenantId, (tx) =>
    tx.transactionAttachment.deleteMany({ where: { id: rowId, transactionId: id } }),
  );
  revalidateTxn(id);
}

/**
 * Tick or untick a row. Deliberately independent of whether a file is
 * attached: a disclosure signed in person is done with nothing to show, and a
 * contract can be sitting right there while the row still waits on the other
 * side's countersignature.
 */
export async function toggleAttachmentComplete(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowId = str(formData, "rowId");
  if (!id || !rowId) return;
  await withTenant(tenantId, async (tx) => {
    const row = await tx.transactionAttachment.findFirst({
      where: { id: rowId, transactionId: id },
      select: { completedAt: true },
    });
    if (!row) return;
    await tx.transactionAttachment.updateMany({
      where: { id: rowId, transactionId: id },
      data: { completedAt: row.completedAt ? null : new Date() },
    });
  });
  revalidateTxn(id);
}

/**
 * Rule a row not-applicable to this deal, or put it back.
 *
 * Omitting keeps the row and its reason rather than deleting it: "we
 * considered the survey and it doesn't apply here" is a different, and more
 * useful, statement than the row never having existed. `completedAt` is left
 * alone so un-omitting restores whatever was true before.
 */
export async function setAttachmentOmitted(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowId = str(formData, "rowId");
  if (!id || !rowId) return;
  const reason = optStr(formData, "reason");
  await withTenant(tenantId, async (tx) => {
    const row = await tx.transactionAttachment.findFirst({
      where: { id: rowId, transactionId: id },
      select: { omittedAt: true },
    });
    if (!row) return;
    await tx.transactionAttachment.updateMany({
      where: { id: rowId, transactionId: id },
      data: row.omittedAt
        ? { omittedAt: null, omittedReason: null }
        : { omittedAt: new Date(), omittedReason: reason },
    });
  });
  revalidateTxn(id);
}

/**
 * Put a document on a row, or (with an empty documentId) take it off.
 *
 * A document lives on exactly one row, so this *moves* it: attaching a file
 * that already sits elsewhere clears the old row first. That is what makes
 * both "Move file to…" and accepting an AI filing suggestion work — in the
 * suggestion case the upload already created a row of its own, and without the
 * move the file would appear twice, once under its filename and once under the
 * slot it was just filed into.
 */
export async function linkAttachmentDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowId = str(formData, "rowId");
  if (!id || !rowId) return;
  const documentId = optStr(formData, "documentId");
  await withTenant(tenantId, async (tx) => {
    if (documentId) {
      // Only accept a document that actually lives on this transaction.
      const doc = await tx.document.findFirst({
        where: { id: documentId, transactionId: id },
        select: { id: true },
      });
      if (!doc) return;
      // Vacate whatever row held it. A row that existed only to carry this
      // file goes; one that expects something stays and simply empties.
      await tx.transactionAttachment.deleteMany({
        where: {
          documentId,
          transactionId: id,
          id: { not: rowId },
          required: false,
          folderId: null,
          omittedAt: null,
          notes: { none: {} },
        },
      });
      await tx.transactionAttachment.updateMany({
        where: { documentId, transactionId: id, id: { not: rowId } },
        data: { documentId: null, completedAt: null },
      });
    }
    await tx.transactionAttachment.updateMany({
      where: { id: rowId, transactionId: id },
      // Attaching a file satisfies the row; detaching reopens it.
      data: { documentId, completedAt: documentId ? new Date() : null },
    });
  });
  revalidateTxn(id);
}

/** Move a row into a folder, or (with an empty folderId) out of all of them. */
export async function setAttachmentFolder(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowId = str(formData, "rowId");
  if (!id || !rowId) return;
  const folderId = optStr(formData, "folderId");
  await withTenant(tenantId, async (tx) => {
    if (folderId) {
      // A folder from another transaction would be a cross-file leak.
      const folder = await tx.attachmentFolder.findFirst({
        where: { id: folderId, transactionId: id },
        select: { id: true },
      });
      if (!folder) return;
    }
    await tx.transactionAttachment.updateMany({
      where: { id: rowId, transactionId: id },
      data: { folderId },
    });
  });
  revalidateTxn(id);
}

export async function createAttachmentFolder(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const name = str(formData, "name").trim();
  if (!id || !name) return;
  // resolveFolders already matches case-insensitively and creates only what's
  // missing, so asking twice for "Contract" is a no-op rather than an error.
  await withTenant(tenantId, (tx) => resolveFolders(tx, tenantId, id, [name]));
  revalidateTxn(id);
}

export async function renameAttachmentFolder(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const folderId = str(formData, "folderId");
  const name = str(formData, "name").trim();
  if (!id || !folderId || !name) return;
  await withTenant(tenantId, async (tx) => {
    const clash = await tx.attachmentFolder.findFirst({
      where: { transactionId: id, name, id: { not: folderId } },
      select: { id: true },
    });
    if (clash) return; // the unique index would reject it anyway
    await tx.attachmentFolder.updateMany({
      where: { id: folderId, transactionId: id },
      data: { name },
    });
  });
  revalidateTxn(id);
}

/**
 * Delete a folder. The rows inside it survive and fall back to ungrouped
 * (SetNull) — a folder is a way of arranging the list, and throwing one away
 * should never throw away what was filed in it.
 */
export async function deleteAttachmentFolder(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const folderId = str(formData, "folderId");
  if (!id || !folderId) return;
  await withTenant(tenantId, (tx) =>
    tx.attachmentFolder.deleteMany({ where: { id: folderId, transactionId: id } }),
  );
  revalidateTxn(id);
}

/** A comment on a row — "waiting on the lender", "page 3 is unsigned". */
export async function addAttachmentNote(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const rowId = str(formData, "rowId");
  const body = str(formData, "body").trim();
  if (!id || !rowId || !body) return;
  await withTenant(tenantId, async (tx) => {
    const row = await tx.transactionAttachment.findFirst({
      where: { id: rowId, transactionId: id },
      select: { id: true },
    });
    if (!row) return;
    await tx.attachmentNote.create({
      data: {
        tenantId,
        attachmentId: row.id,
        body,
        authorId: session.user.id,
        authorName: session.user.name ?? session.user.email,
      },
    });
  });
  revalidateTxn(id);
}

export async function deleteAttachmentNote(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const noteId = str(formData, "noteId");
  if (!id || !noteId) return;
  await withTenant(tenantId, async (tx) => {
    // Scope through the row so a note id from another file can't be reached.
    const note = await tx.attachmentNote.findFirst({
      where: { id: noteId, attachment: { transactionId: id } },
      select: { id: true },
    });
    if (!note) return;
    await tx.attachmentNote.delete({ where: { id: note.id } });
  });
  revalidateTxn(id);
}

/**
 * Load a row together with the parties who could sign it.
 *
 * The signers come from the transaction's own participants rather than being
 * stored on the row, so adding the buyer's agent to the file makes them
 * appear on every tracked document at once.
 */
async function rowWithSigners(tenantId: string, transactionId: string, rowId: string) {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.transactionAttachment.findFirst({
      where: { id: rowId, transactionId },
      select: { id: true, signatureState: true },
    });
    if (!row) return null;
    const parties = await tx.transactionParty.findMany({
      where: { transactionId },
      select: { id: true, role: true, contact: { select: { name: true } } },
    });
    return { row, signers: signerParties(parties) };
  });
}

/**
 * Start or stop tracking signatures on a row.
 *
 * Off is `null`, on is `{}` — an empty map means "tracking, nobody yet", which
 * is a different statement from "we aren't tracking this", and the pills need
 * to be able to say the first one.
 */
export async function setAttachmentSignatureTracking(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowId = str(formData, "rowId");
  if (!id || !rowId) return;
  await withTenant(tenantId, async (tx) => {
    const row = await tx.transactionAttachment.findFirst({
      where: { id: rowId, transactionId: id },
      select: { signatureState: true },
    });
    if (!row) return;
    await tx.transactionAttachment.updateMany({
      where: { id: rowId, transactionId: id },
      data: { signatureState: readSignatureState(row.signatureState) ? Prisma.DbNull : {} },
    });
  });
  revalidateTxn(id);
}

/** Tick or untick one party on a tracked row. */
export async function toggleAttachmentSigner(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowId = str(formData, "rowId");
  const partyId = str(formData, "partyId");
  if (!id || !rowId || !partyId) return;
  const loaded = await rowWithSigners(tenantId, id, rowId);
  if (!loaded) return;
  if (!loaded.signers.some((p) => p.id === partyId)) return; // not a signer on this file
  const next = toggleSigner(readSignatureState(loaded.row.signatureState), partyId);
  await withTenant(tenantId, (tx) =>
    tx.transactionAttachment.updateMany({
      where: { id: rowId, transactionId: id },
      data: { signatureState: pruneSignatures(next, loaded.signers) },
    }),
  );
  revalidateTxn(id);
}

/**
 * "Executed": everyone signed, and the row is done.
 *
 * A fully signed document is a satisfied row in every case a coordinator
 * cares about, so this ticks the row too rather than leaving the last step to
 * be noticed separately.
 */
export async function executeAttachmentSignatures(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowId = str(formData, "rowId");
  if (!id || !rowId) return;
  const loaded = await rowWithSigners(tenantId, id, rowId);
  if (!loaded || loaded.signers.length === 0) return;
  const next = signAll(readSignatureState(loaded.row.signatureState), loaded.signers);
  await withTenant(tenantId, (tx) =>
    tx.transactionAttachment.updateMany({
      where: { id: rowId, transactionId: id },
      data: { signatureState: next, completedAt: new Date() },
    }),
  );
  revalidateTxn(id);
}

// --- Bulk actions ---------------------------------------------------------
//
// All of these take the same `rowIds` set from the tab's selection form. They
// are separate actions rather than one action with an operation field so each
// button carries its own `formAction` — the browser then does the dispatch,
// and there is no string to get out of step with a switch statement.
//
// Every query stays scoped by transactionId as well as row id, so a
// hand-posted id belonging to another file matches nothing.

/** Row ids from the selection form, capped so one post can't run forever. */
const MAX_BULK = 200;

function selectedRows(formData: FormData): string[] {
  return formData.getAll("rowIds").map(String).filter(Boolean).slice(0, MAX_BULK);
}

export async function bulkOmitAttachments(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowIds = selectedRows(formData);
  if (!id || rowIds.length === 0) return;
  await withTenant(tenantId, (tx) =>
    tx.transactionAttachment.updateMany({
      // Explicitly set rather than toggled: with a mixed selection, "Omit"
      // has to mean omit, not "flip each of these to the opposite of
      // whatever it was".
      where: { id: { in: rowIds }, transactionId: id, omittedAt: null },
      data: { omittedAt: new Date() },
    }),
  );
  revalidateTxn(id);
}

export async function bulkIncludeAttachments(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowIds = selectedRows(formData);
  if (!id || rowIds.length === 0) return;
  await withTenant(tenantId, (tx) =>
    tx.transactionAttachment.updateMany({
      where: { id: { in: rowIds }, transactionId: id },
      data: { omittedAt: null, omittedReason: null },
    }),
  );
  revalidateTxn(id);
}

export async function bulkMoveAttachments(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowIds = selectedRows(formData);
  if (!id || rowIds.length === 0) return;
  const folderId = optStr(formData, "bulkFolderId");
  await withTenant(tenantId, async (tx) => {
    if (folderId) {
      const folder = await tx.attachmentFolder.findFirst({
        where: { id: folderId, transactionId: id },
        select: { id: true },
      });
      if (!folder) return;
    }
    await tx.transactionAttachment.updateMany({
      where: { id: { in: rowIds }, transactionId: id },
      data: { folderId },
    });
  });
  revalidateTxn(id);
}

export async function bulkDeleteAttachments(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowIds = selectedRows(formData);
  if (!id || rowIds.length === 0) return;
  // Removes the rows, not the files behind them: a document survives in the
  // library and its version history, and deleting bytes is a per-file,
  // type-DELETE decision that shouldn't ride along on a multi-select.
  await withTenant(tenantId, (tx) =>
    tx.transactionAttachment.deleteMany({
      where: { id: { in: rowIds }, transactionId: id },
    }),
  );
  revalidateTxn(id);
}

/** Resolve selected rows to the documents they actually hold. */
async function documentsForRows(tenantId: string, transactionId: string, rowIds: string[]) {
  if (rowIds.length === 0) return [];
  const rows = await withTenant(tenantId, (tx) =>
    tx.transactionAttachment.findMany({
      where: { id: { in: rowIds }, transactionId, documentId: { not: null } },
      orderBy: { sortOrder: "asc" },
      select: { documentId: true },
    }),
  );
  return rows.map((r) => r.documentId).filter((v): v is string => Boolean(v));
}

/**
 * Zip the selected rows' files.
 *
 * A redirect rather than a streamed response: the selection lives in a POST
 * form (it has to, to share checkboxes with the other bulk buttons), and a
 * POST can't produce a browser download the back button survives. The zip
 * route already knows how to filter by document id.
 */
export async function bulkZipAttachments(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowIds = selectedRows(formData);
  if (!id || rowIds.length === 0) return;
  const docIds = await documentsForRows(tenantId, id, rowIds);
  if (docIds.length === 0) return; // nothing selected holds a file
  const qs = docIds.map((d) => `doc=${encodeURIComponent(d)}`).join("&");
  redirect(`/api/transactions/${id}/documents/zip?${qs}`);
}

/**
 * Open the compose form with the selected files already attached — the
 * "send the lender these four documents" errand, which is otherwise four
 * trips through the email tab.
 */
export async function bulkEmailAttachments(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowIds = selectedRows(formData);
  if (!id || rowIds.length === 0) return;
  const docIds = await documentsForRows(tenantId, id, rowIds);
  if (docIds.length === 0) return;
  const qs = docIds.map((d) => `attachDoc=${encodeURIComponent(d)}`).join("&");
  redirect(`/dashboard/transactions/${id}?tab=emails&${qs}`);
}

/**
 * Show or hide an outstanding row on the client portal.
 *
 * Only meaningful while the row is empty: once a document is attached, what
 * the client sees is governed by that document's own visibleToClient, which
 * is the toggle coordinators already use everywhere else.
 */
export async function toggleAttachmentPortalVisible(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const rowId = str(formData, "rowId");
  if (!id || !rowId) return;
  await withTenant(tenantId, async (tx) => {
    const row = await tx.transactionAttachment.findFirst({
      where: { id: rowId, transactionId: id },
      select: { visibleToClient: true },
    });
    if (!row) return;
    await tx.transactionAttachment.updateMany({
      where: { id: rowId, transactionId: id },
      data: { visibleToClient: !row.visibleToClient },
    });
  });
  revalidateTxn(id);
}
