"use server";

import { ExtractionStatus, FieldTarget, TransactionStatus, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ContractParty, transactionUpdateFor } from "@/lib/ai/contract-schema";
import { completeExtraction, extractionModel } from "@/lib/ai/extraction-run";
import { optStr, str } from "@/lib/forms";
import {
  creditBalance,
  getTenantPlan,
  isCloud,
  spendCreditForTransaction,
  transactionHasPro,
  transactionLimit,
} from "@/lib/plans";
import { deriveSide } from "@/lib/side-derive";
import { putObject } from "@/lib/storage";
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

/** Run extraction over a contract already attached to a transaction. */
export async function runExtraction(formData: FormData) {
  const { tenantId } = await requireTenant();
  const documentId = str(formData, "documentId");
  if (!documentId) return;

  const model = await extractionModel(tenantId);
  const { extraction, doc, allowed } = await withTenant(tenantId, async (tx) => {
    const doc = await tx.document.findUniqueOrThrow({
      where: { id: documentId },
      select: {
        id: true,
        transactionId: true,
        data: true,
        storageKey: true,
        contentType: true,
        storageProvider: true,
        tenantId: true,
        transaction: { select: { proFeaturesEnabled: true } },
      },
    });
    // Pro-AI gate: paid plans (and self-host) always pass; a Free workspace
    // must have spent a credit on this transaction. The page hides the button
    // otherwise — this is the server-side enforcement.
    const allowed = await transactionHasPro(tenantId, doc.transaction.proFeaturesEnabled);
    if (!allowed) return { extraction: null, doc, allowed };
    const extraction = await tx.contractExtraction.create({
      data: {
        tenantId,
        documentId: doc.id,
        transactionId: doc.transactionId,
        model,
        status: ExtractionStatus.RUNNING,
      },
    });
    return { extraction, doc, allowed };
  });

  if (!allowed || !extraction) return;

  await completeExtraction(tenantId, extraction.id, doc, model, doc.transactionId);

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
  const { tenantId, userId } = await requireTenant();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return;
  // Optional: naming the client here is what lets us work out the side below.
  const clientId = optStr(formData, "clientId");

  // Plan cap first — never strand an upload against a full plan. Then, on Cloud
  // Free, upload-and-extract opts this brand-new transaction into pro AI (the
  // action IS the AI use), so it needs a credit up front; with none, send them
  // to buy rather than create an unusable transaction.
  const limit = await transactionLimit(tenantId);
  if (limit.limited) redirect("/dashboard/transactions");
  const plan = await getTenantPlan(tenantId);
  const needsCredit = isCloud() && plan.tier === "FREE";
  if (needsCredit && (await creditBalance(tenantId)) < 1) {
    redirect("/dashboard/billing?need=credits");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = file.name || "contract.pdf";
  const contentType = file.type || "application/pdf";
  const stored = await putObject(tenantId, filename, bytes, contentType);
  const model = await extractionModel(tenantId);

  const { transaction, extraction, doc } = await withTenant(tenantId, async (tx) => {
    const safeClientId = clientId
      ? ((await tx.client.findUnique({ where: { id: clientId }, select: { id: true } }))?.id ??
        null)
      : null;
    const transaction = await tx.transaction.create({
      data: {
        tenantId,
        propertyAddress: provisionalAddress(filename),
        status: TransactionStatus.UNDER_CONTRACT,
        // Re-read under RLS rather than trusted from the form: a hand-posted
        // clientId naming another tenant's client would otherwise pass the
        // foreign-key check and link the file across workspaces.
        ...(safeClientId ? { clientId: safeClientId } : {}),
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
        storageProvider: stored.storageProvider,
      },
      select: { id: true, data: true, storageKey: true, storageProvider: true, tenantId: true },
    });
    const extraction = await tx.contractExtraction.create({
      data: {
        tenantId,
        documentId: doc.id,
        transactionId: transaction.id,
        model,
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

  // Spend the credit on the transaction we just created, unlocking pro for it
  // permanently. Paid/self-host skip this entirely.
  if (needsCredit) await spendCreditForTransaction(tenantId, transaction.id, userId);

  await completeExtraction(tenantId, extraction.id, doc, model, transaction.id);
  await addDerivedSideField(tenantId, extraction.id, clientId);

  revalidatePath("/dashboard/transactions");
  redirect(`/dashboard/transactions/${transaction.id}/extractions/${extraction.id}`);
}

/**
 * Work out which side of the deal is ours and add it to the review, from the
 * client named at upload matched against the agents the extractor found.
 *
 * A contract names a buyer's agent and a listing agent but never says which
 * one hired us, and the same agent is a buyer's agent on one file and the
 * listing agent on the next — so the side can't live on the client record. It
 * has to be derived per deal, and it's worth deriving: side decides which
 * fields the form shows, which price column means anything, and which agent
 * the client portal hides from the other party.
 *
 * The row is always added when a client was chosen, even when nothing
 * matched. A confident match arrives checked; an unmatched one arrives blank
 * and LOW, which the review screen leaves unticked, so the reviewer is asked
 * rather than defaulted. Nothing here writes to the transaction — applying is
 * still their click.
 */
async function addDerivedSideField(
  tenantId: string,
  extractionId: string,
  clientId: string | null,
) {
  if (!clientId) return;

  await withTenant(tenantId, async (tx) => {
    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { name: true, agents: { select: { contact: { select: { name: true } } } } },
    });
    if (!client) return;

    // The extractor already stored both agents as party rows.
    const parties = await tx.extractionField.findMany({
      where: { extractionId, key: { in: ["party:buyer_agent", "party:listing_agent"] } },
      select: { key: true, value: true, page: true },
    });
    const agentOf = (role: string) => parties.find((p) => p.key === `party:${role}`) ?? null;
    const buyer = agentOf("buyer_agent");
    const listing = agentOf("listing_agent");

    const match = deriveSide({
      clientNames: [client.name, ...client.agents.map((a) => a.contact.name)],
      buyerAgent: buyer?.value ?? null,
      listingAgent: listing?.value ?? null,
    });

    const max = await tx.extractionField.aggregate({
      where: { extractionId },
      _max: { sortOrder: true },
    });

    await tx.extractionField.create({
      data: {
        tenantId,
        extractionId,
        key: "side",
        label: "Which side is yours",
        value: match?.side ?? "",
        valueType: "TEXT",
        target: FieldTarget.TRANSACTION_FIELD,
        confidence: match ? "HIGH" : "LOW",
        page: (match?.side === "SELL_SIDE" ? listing?.page : buyer?.page) ?? null,
        quote: match
          ? `${client.name} matched "${match.matchedOn}" on the contract`
          : `Couldn't match ${client.name} to either agent named on the contract — pick the side.`,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
  });
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
      include: {
        fields: true,
        transaction: { select: { id: true, customFields: true, contractParties: true } },
      },
    });
    // A reviewer can correct a value before applying it — today that's the
    // property address, fixed with the same Mapbox picker used everywhere
    // else, because a contract's address is often abbreviated or misspelled
    // and it's the one field every later lookup keys off. Anything not
    // overridden keeps exactly what the model read.
    const chosen = extraction.fields
      .filter((f) => selectedIds.includes(f.id))
      .map((f) => {
        const edited = formData.get(`value:${f.id}`);
        const next = typeof edited === "string" ? edited.trim() : "";
        return next && next !== f.value ? { ...f, value: next } : f;
      });

    const columnUpdates: Record<string, unknown> = {};
    const customFields = {
      ...((extraction.transaction.customFields as Record<string, string> | null) ?? {}),
    };
    // Parties land in their own locked panel (an ordered role/value list), not
    // in customFields — so two same-role parties (buyer + seller attorney)
    // both survive instead of one clobbering the other.
    const parties: ContractParty[] = [
      ...((extraction.transaction.contractParties as ContractParty[] | null) ?? []),
    ];
    let maxSort = 0;

    for (const field of chosen) {
      if (field.target === FieldTarget.TRANSACTION_FIELD) {
        const fragment = transactionUpdateFor(field.key, field.value);
        if (fragment) Object.assign(columnUpdates, fragment);
        else customFields[field.label] = field.value; // unparseable → still captured
      } else if (field.target === FieldTarget.CUSTOM_FIELD) {
        customFields[field.label] = field.value;
      } else if (field.target === FieldTarget.PARTY) {
        const role = field.key.startsWith("party:") ? field.key.slice("party:".length) : "other";
        const value = field.value.trim();
        // Dedupe on re-apply, but keep distinct people who share a role.
        if (value && !parties.some((p) => p.role === role && p.value === value)) {
          parties.push({ role, value });
        }
      }
    }

    // If the reviewer corrected the address with the picker, the city/state/ZIP
    // that came with the chosen suggestion apply too — otherwise the file ends
    // up with a Haverhill street address still filed under Springfield. Only
    // when the address field was actually applied, and never blanking a column
    // the picker had nothing to say about.
    if (chosen.some((f) => f.key === "property_address")) {
      for (const [param, column] of [
        ["addr:city", "city"],
        ["addr:state", "state"],
        ["addr:zip", "zip"],
      ] as const) {
        const value = formData.get(param);
        if (typeof value === "string" && value.trim()) columnUpdates[column] = value.trim();
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
      data: {
        ...columnUpdates,
        customFields,
        contractParties: parties as unknown as Record<string, string>[],
      },
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
