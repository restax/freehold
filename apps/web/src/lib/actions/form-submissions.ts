"use server";

import { type ClientType, type PartyRole, type TransactionSide, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import {
  clientDraftFrom,
  partiesFrom,
  transactionDraftFrom,
  unmappedAnswers,
} from "@/lib/form-convert";
import { isFormKind, MAPPED_FIELDS } from "@/lib/form-schema";
import { str } from "@/lib/forms";
import { requireTenant } from "@/lib/tenant";

/**
 * Reviewing what the public sent in.
 *
 * Conversion reads the submission's own snapshot and answers, never the
 * live form — a form edited since can't change what an old submission
 * becomes. Everything for one submission happens in a single transaction,
 * so a half-converted record is not a state this can end in, and the
 * submission is stamped with what it produced so the same one can't be
 * converted twice.
 */

function answersOf(submission: { data: unknown }): Record<string, unknown> {
  const d = submission.data;
  return d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
}

/** The TC's own questions, appended to the record's notes rather than lost. */
function notesFrom(kind: "client_intake" | "transaction_intake", values: Record<string, unknown>) {
  const extra = unmappedAnswers(
    values,
    MAPPED_FIELDS[kind].map((f) => f.key),
  );
  if (extra.length === 0) return null;
  return extra.map((e) => `${e.key}: ${e.value}`).join("\n");
}

/** Annotated so the branches stay a discriminated union through withTenant. */
type ConvertResult =
  | { error: string }
  | { kind: "client"; id: string; name: string }
  | { kind: "transaction"; id: string; name: string }
  | null;

export async function convertSubmission(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;

  const result: ConvertResult = await withTenant(tenantId, async (tx): Promise<ConvertResult> => {
    const sub = await tx.formSubmission.findUnique({
      where: { id },
      include: { files: true },
    });
    // Already handled, or gone — converting twice would duplicate the file.
    if (sub?.status !== "new" || !isFormKind(sub.formKind)) return null;
    const values = answersOf(sub);

    if (sub.formKind === "client_intake") {
      const draft = clientDraftFrom(values);
      if (!draft) return { error: "This submission has no name to make a client from." };
      const notes = notesFrom("client_intake", values);
      const client = await tx.client.create({
        data: {
          tenantId,
          name: draft.name,
          type: draft.type as ClientType,
          email: draft.email,
          phone: draft.phone,
          address: draft.address,
          ...(draft.brokerageInfo && { brokerageInfo: draft.brokerageInfo }),
          ...(draft.billingContact && { billingContact: draft.billingContact }),
          ...(notes && { notes }),
        },
      });
      await tx.formSubmission.update({
        where: { id },
        data: {
          status: "converted",
          convertedClientId: client.id,
          reviewedAt: new Date(),
          reviewedByName: session.user.name,
        },
      });
      return { kind: "client" as const, id: client.id, name: client.name };
    }

    // --- transaction ---
    const draft = transactionDraftFrom(values);
    if (!draft) return { error: "This submission has no property address to open a file with." };
    const notes = notesFrom("transaction_intake", values);
    const txn = await tx.transaction.create({
      data: {
        tenantId,
        propertyAddress: draft.propertyAddress,
        city: draft.city,
        state: draft.state,
        zip: draft.zip,
        side: draft.side as TransactionSide,
        purchasePrice: draft.purchasePrice,
        contractDate: draft.contractDate,
        closeDate: draft.closeDate,
        mlsId: draft.mlsId,
        notes: [draft.notes, notes].filter(Boolean).join("\n\n") || null,
        // An identified submission already knows whose file this is.
        ...(sub.clientId && { clientId: sub.clientId }),
      },
    });

    // Parties become real contacts on the file.
    for (const p of partiesFrom(values)) {
      const contact = await tx.contact.create({
        data: {
          tenantId,
          name: p.name,
          email: p.email ?? null,
          phone: p.phone ?? null,
          category: "Intake",
        },
      });
      await tx.transactionParty.create({
        data: {
          tenantId,
          transactionId: txn.id,
          contactId: contact.id,
          role: p.role as PartyRole,
        },
      });
    }

    // Uploads become documents on the file now that a person has vouched
    // for them — this is the moment they're allowed into the library.
    const documentIds: string[] = [];
    for (const f of sub.files) {
      const doc = await tx.document.create({
        data: {
          tenantId,
          transactionId: txn.id,
          filename: `Intake — ${f.filename}`,
          contentType: f.contentType,
          sizeBytes: f.sizeBytes,
          data: f.data,
          storageKey: f.storageKey,
          storageProvider: f.storageProvider,
          visibleToClient: false,
          visibleToAgent: true,
        },
      });
      documentIds.push(doc.id);
    }

    await tx.formSubmission.update({
      where: { id },
      data: {
        status: "converted",
        convertedTransactionId: txn.id,
        documentIds,
        reviewedAt: new Date(),
        reviewedByName: session.user.name,
      },
    });
    return { kind: "transaction" as const, id: txn.id, name: txn.propertyAddress };
  });

  if (!result) return;
  if ("error" in result) {
    redirect(`/dashboard/forms/submissions?convertError=${encodeURIComponent(result.error)}`);
  }

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "form.submission_converted",
    summary: `Converted a form submission into "${result.name}"`,
    subjectType: "form_submission",
    subjectId: id,
  });
  revalidatePath("/dashboard/forms/submissions");
  redirect(
    result.kind === "client"
      ? `/dashboard/clients/${result.id}`
      : `/dashboard/transactions/${result.id}`,
  );
}

/** Not everything that arrives is real. Dismissing keeps the record. */
export async function dismissSubmission(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) =>
    tx.formSubmission.updateMany({
      where: { id, status: "new" },
      data: { status: "dismissed", reviewedAt: new Date(), reviewedByName: session.user.name },
    }),
  );
  revalidatePath("/dashboard/forms/submissions");
}

/** Put a dismissed submission back in the queue. */
export async function reopenSubmission(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) =>
    tx.formSubmission.updateMany({
      where: { id, status: "dismissed" },
      data: { status: "new", reviewedAt: null, reviewedByName: null },
    }),
  );
  revalidatePath("/dashboard/forms/submissions");
}
