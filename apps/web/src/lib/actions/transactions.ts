"use server";

import {
  prisma,
  type TenantTx,
  TransactionSide,
  TransactionStatus,
  withTenant,
} from "@freehold/db";
import { type AnchorDates, anchorDate } from "@freehold/workflows";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import type { ContractParty } from "@/lib/ai/contract-schema";
import { logAudit } from "@/lib/audit";
import { fireIntroEmail, firePostCloseEmail } from "@/lib/auto-emails";
import { ensureAutoDraft } from "@/lib/billing-drafts";
import { resolveDefaultFee, tenantBillingPolicy } from "@/lib/billing-policy";
import { parseCommissionPct, parseGrossCents } from "@/lib/commission";
import { fmtMoney } from "@/lib/format";
import { confirmed, dateOnly, intOr, oneOf, optStr, str } from "@/lib/forms";
import {
  amendmentTitle,
  GOVERNED_DATE_FIELDS,
  type GovernedDateField,
  governedDateDecision,
  isGovernedDateField,
  isKeyDateField,
  KEY_DATE_LABELS,
  type KeyDateField,
} from "@/lib/governed-dates";
import { gapForPending, gapMessage, licenseEnforcement } from "@/lib/licensing";
import { parseFeeCents } from "@/lib/pay";
import { transactionLimit } from "@/lib/plans";
import { deleteObject } from "@/lib/storage";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";
import { emitWebhook } from "@/lib/webhook-emit";

const STATUSES = Object.values(TransactionStatus);
const SIDES = Object.values(TransactionSide);

function commonFields(formData: FormData) {
  return {
    status: oneOf(formData, "status", STATUSES, TransactionStatus.UNDER_CONTRACT),
    side: oneOf(formData, "side", SIDES, TransactionSide.BUY_SIDE),
    clientId: optStr(formData, "clientId"),
    city: optStr(formData, "city"),
    state: optStr(formData, "state"),
    zip: optStr(formData, "zip"),
    purchasePrice: intOr(formData, "purchasePrice"),
    contractDate: dateOnly(formData, "contractDate"),
    closeDate: dateOnly(formData, "closeDate"),
    // Critical dates the staleness alerts escalate on. Unlike closeDate these
    // aren't contract-governed, so they edit directly without an amendment.
    mortgageCommitmentDate: dateOnly(formData, "mortgageCommitmentDate"),
    inspectionDeadlineDate: dateOnly(formData, "inspectionDeadlineDate"),
    listPrice: intOr(formData, "listPrice"),
    listDate: dateOnly(formData, "listDate"),
    onMarketDate: dateOnly(formData, "onMarketDate"),
    expireDate: dateOnly(formData, "expireDate"),
    mlsId: optStr(formData, "mlsId"),
    notes: optStr(formData, "notes"),
    // Expected fee: only forms that carry the field can change it. Blank means
    // "fall back to the client/workspace default" (re-resolved below); an
    // explicit 0 means this file is deliberately not billed.
    ...(formData.has("expectedFee")
      ? { expectedFeeCents: parseFeeCents(str(formData, "expectedFee")) }
      : {}),
    // Agents & commissions, each behind the same guard, so a form without that
    // section can't null a commission somebody entered. This is the shape of
    // the bug that quietly wiped every file's listing details for months.
    ...(formData.has("commissionPct")
      ? { commissionPct: parseCommissionPct(str(formData, "commissionPct")) }
      : {}),
    ...(formData.has("estimatedGross")
      ? { estimatedGrossCents: parseGrossCents(str(formData, "estimatedGross")) }
      : {}),
    ...(formData.has("actualGross")
      ? { actualGrossCents: parseGrossCents(str(formData, "actualGross")) }
      : {}),
    ...(formData.has("commissionNote")
      ? { commissionNote: optStr(formData, "commissionNote") }
      : {}),
  };
}

/**
 * A file with no expected fee inherits the client's default (else the
 * workspace's). Runs after create/update so "blank" always means "default",
 * never silently zero — the trust surface depends on this number existing.
 */
async function resolvedExpectedFee(
  tx: TenantTx,
  tenantId: string,
  clientId: string | null | undefined,
  current: number | null | undefined,
): Promise<number | null> {
  if (current != null) return current;
  if (!clientId) return null;
  const [client, org] = await Promise.all([
    tx.client.findUnique({ where: { id: clientId }, select: { defaultFeeCents: true } }),
    prisma.organization.findUnique({ where: { id: tenantId }, select: { billingDefaults: true } }),
  ]);
  return resolveDefaultFee(client?.defaultFeeCents, tenantBillingPolicy(org?.billingDefaults));
}

/**
 * Contact ids from a form, narrowed to contacts that actually belong to this
 * workspace. A hand-posted id naming another tenant's contact would otherwise
 * satisfy the foreign key and link a stranger onto the file — FK checks don't
 * go through RLS.
 */
async function safeContactIds(
  tx: TenantTx,
  ids: Array<string | null>,
): Promise<Record<string, string | null>> {
  const wanted = ids.filter((v): v is string => Boolean(v));
  if (wanted.length === 0) return {};
  const found = new Set(
    (await tx.contact.findMany({ where: { id: { in: wanted } }, select: { id: true } })).map(
      (c) => c.id,
    ),
  );
  return Object.fromEntries(wanted.map((id) => [id, found.has(id) ? id : null]));
}

/** The workspace users picked as TC/assistants, verified as members here. */
async function safeAssigneeIds(tx: TenantTx, ids: Array<string | null>): Promise<string[]> {
  const wanted = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (wanted.length === 0) return [];
  const members = await tx.member.findMany({
    where: { userId: { in: wanted } },
    select: { userId: true },
  });
  const ok = new Set(members.map((m) => m.userId));
  return wanted.filter((id) => ok.has(id));
}

export async function createTransaction(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const propertyAddress = str(formData, "propertyAddress");
  if (!propertyAddress) return;
  const limit = await transactionLimit(tenantId);
  if (limit.limited) return; // cloud free-tier cap; the page shows the upgrade banner
  // Two TC/assistant slots on the form; a workspace may only have one person.
  const assigneeIds = formData.getAll("assigneeIds").map(String).filter(Boolean);
  const fields = commonFields(formData);
  const primaryAgentId = optStr(formData, "primaryAgentContactId");
  const coAgentId = optStr(formData, "coAgentContactId");

  // Under "block" enforcement a file in a license-required state can't be
  // created without a licensed coordinator on it. Under "warn" it saves and
  // the file carries a flag instead.
  const enforcement = await licenseEnforcement(tenantId);
  if (enforcement === "block") {
    const gap = await withTenant(tenantId, (tx) => gapForPending(tx, fields.state, assigneeIds));
    if (gap) {
      // Back to the form that was being filled, not the list — the
      // coordinator needs to change the assignee and try again.
      redirect(`/dashboard/transactions/new?licenseError=${encodeURIComponent(gapMessage(gap))}`);
    }
  }

  const created = await withTenant(tenantId, async (tx) => {
    const expectedFeeCents = await resolvedExpectedFee(
      tx,
      tenantId,
      fields.clientId,
      fields.expectedFeeCents,
    );
    const contacts = await safeContactIds(tx, [primaryAgentId, coAgentId]);
    const txn = await tx.transaction.create({
      data: {
        tenantId,
        propertyAddress,
        ...fields,
        expectedFeeCents,
        primaryAgentContactId: primaryAgentId ? (contacts[primaryAgentId] ?? null) : null,
        coAgentContactId: coAgentId ? (contacts[coAgentId] ?? null) : null,
      },
    });
    // Optional create-time assignment; more people can be added on the file.
    const assignees = await safeAssigneeIds(tx, assigneeIds);
    if (assignees.length > 0) {
      await tx.transactionAssignee.createMany({
        data: assignees.map((userId) => ({ tenantId, transactionId: txn.id, userId })),
      });
    }
    return txn;
  });
  // Billing policy may want an invoice at entry (upfront/per-entry modes) —
  // a reviewed DRAFT, never auto-sent.
  await ensureAutoDraft(tenantId, created.id, "entry");
  await emitWebhook(tenantId, "transaction.created", {
    id: created.id,
    propertyAddress: created.propertyAddress,
    status: created.status,
    side: created.side,
  });
  // Automated intro email to the client, unless switched off on their profile.
  fireIntroEmail(tenantId, created.id, session.user);
  revalidatePath("/dashboard/transactions");
  redirect(`/dashboard/transactions/${created.id}`);
}

/**
 * Set one date from the Key dates panel, and nothing else.
 *
 * Deliberately *not* updateTransaction. That reads the whole edit form —
 * status, side, prices, MLS id, notes — and a form carrying only one date
 * would blank every field it didn't send. That exact shape of bug already
 * cost this codebase months of quietly wiped listing details (see the guards
 * in commonFields), and a one-field inline editor is the easiest possible way
 * to reintroduce it. So this touches exactly the column it was given.
 *
 * The column name comes off the wire, so it's checked against the map above
 * rather than trusted — otherwise "field" would be an arbitrary write into
 * any column on the row.
 *
 * Contract and close dates still obey the amendment rule: changing an agreed
 * date proposes rather than applies. Editing them here is no different from
 * editing them on the full form, which is the point of sharing the decision.
 */
/**
 * The core of `updateKeyDate`, factored out so a bulk caller (applying a
 * date template) can write several fields in one transaction without
 * re-deriving the governed-date branching per field — the amendment rule
 * has to hold identically everywhere a key date can be written, and a
 * second copy of it is a second place to forget to update.
 */
export async function writeKeyDate(
  tx: TenantTx,
  tenantId: string,
  actorId: string,
  transactionId: string,
  key: KeyDateField,
  next: Date | null,
): Promise<{ proposedValue: string | null }> {
  const existing = await tx.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    select: { ...ANCHOR_DATE_SELECT, onMarketDate: true, proposedDates: true },
  });

  if (isGovernedDateField(key)) {
    const decision = governedDateDecision(existing[key], next);
    if (decision.kind === "noop") return { proposedValue: null };
    if (decision.kind === "propose") {
      await raiseAmendmentTask(tx, {
        tenantId,
        transactionId,
        actorId,
        field: key,
        value: decision.value,
      });
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          proposedDates: {
            ...((existing.proposedDates as Record<string, string> | null) ?? {}),
            [key]: decision.value,
          },
        },
      });
      return { proposedValue: decision.value };
    }
  }

  const updated = await tx.transaction.update({
    where: { id: transactionId },
    data: { [key]: next },
    select: ANCHOR_DATE_SELECT,
  });
  // Any date a plan task can anchor to moves those tasks — not just the
  // two contract-governed ones. Editing the inspection deadline re-dates
  // the tasks that follow it, the same way changing the closing does.
  if (isAnchorDateField(key)) await recomputeAnchoredTasks(tx, transactionId, updated);
  return { proposedValue: null };
}

/**
 * Set one date from the Key dates panel, and nothing else.
 *
 * Deliberately *not* updateTransaction. That reads the whole edit form —
 * status, side, prices, MLS id, notes — and a form carrying only one date
 * would blank every field it didn't send. That exact shape of bug already
 * cost this codebase months of quietly wiped listing details (see the guards
 * in commonFields), and a one-field inline editor is the easiest possible way
 * to reintroduce it. So this touches exactly the column it was given.
 *
 * The column name comes off the wire, so it's checked against the map above
 * rather than trusted — otherwise "field" would be an arbitrary write into
 * any column on the row.
 *
 * Contract and close dates still obey the amendment rule: changing an agreed
 * date proposes rather than applies. Editing them here is no different from
 * editing them on the full form, which is the point of sharing the decision.
 */
export async function updateKeyDate(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const field = str(formData, "field");
  if (!id || !isKeyDateField(field)) return;
  const key = field;
  const next = dateOnly(formData, "value");

  const { proposedValue } = await withTenant(tenantId, (tx) =>
    writeKeyDate(tx, tenantId, session.user.id, id, key, next),
  );

  logActivity({
    tenantId,
    transactionId: id,
    actor: session.user,
    action: proposedValue ? "transaction.date_proposed" : "transaction.date_updated",
    summary: proposedValue
      ? `Proposed ${KEY_DATE_LABELS[key]} → ${proposedValue} (amendment needed)`
      : `Set ${KEY_DATE_LABELS[key]} to ${next ? next.toISOString().slice(0, 10) : "—"}`,
  });
  revalidatePath(`/dashboard/transactions/${id}`);
}

const LISTING_DETAIL_FIELDS = ["mlsId", "listPrice", "purchasePrice"] as const;
type ListingDetailField = (typeof LISTING_DETAIL_FIELDS)[number];

const LISTING_DETAIL_LABELS: Record<ListingDetailField, string> = {
  mlsId: "MLS ID",
  listPrice: "List price",
  purchasePrice: "Contract price",
};

function isListingDetailField(field: string): field is ListingDetailField {
  return (LISTING_DETAIL_FIELDS as readonly string[]).includes(field);
}

/**
 * One field at a time, by design: commonFields (below) fills every field it
 * knows from the form it was given, so a smaller single-field form routed
 * through it would read every field it doesn't carry as blank and null them
 * out — "the shape of the bug that quietly wiped every file's listing
 * details for months." A dedicated single-column write can't do that.
 */
export async function updateListingDetail(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const field = str(formData, "field");
  if (!id || !isListingDetailField(field)) return;

  const data =
    field === "mlsId"
      ? { mlsId: optStr(formData, "value") }
      : { [field]: intOr(formData, "value") };
  await withTenant(tenantId, (tx) => tx.transaction.update({ where: { id }, data }));

  const display =
    field === "mlsId" ? (optStr(formData, "value") ?? "—") : fmtMoney(intOr(formData, "value"));
  logActivity({
    tenantId,
    transactionId: id,
    actor: session.user,
    action: "transaction.updated",
    summary: `Set ${LISTING_DETAIL_LABELS[field]} to ${display}`,
  });
  revalidatePath(`/dashboard/transactions/${id}`);
}

export async function updateTransaction(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  const propertyAddress = str(formData, "propertyAddress");
  const fields = commonFields(formData);

  // Moving a file into a license-required state is the same decision as
  // creating one there, so it goes through the same gate.
  const enforcement = await licenseEnforcement(tenantId);
  if (enforcement === "block") {
    const gap = await withTenant(tenantId, async (tx) => {
      const assignees = await tx.transactionAssignee.findMany({
        where: { transactionId: id },
        select: { userId: true },
      });
      return gapForPending(
        tx,
        fields.state,
        assignees.map((a) => a.userId),
      );
    });
    if (gap) {
      redirect(`/dashboard/transactions/${id}?licenseError=${encodeURIComponent(gapMessage(gap))}`);
    }
  }

  const redirected: string[] = [];
  let closedNow = false;
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { contractDate: true, closeDate: true, proposedDates: true, status: true },
    });

    closedNow = existing.status !== "CLOSED" && fields.status === "CLOSED";

    // The contract is the source of truth: once a governed date exists,
    // editing it in the form becomes a proposal (amendment to-do), never a
    // silent change. First-time entry (null → value) applies directly and
    // dates the anchored tasks.
    const data: Record<string, unknown> = {
      ...(propertyAddress ? { propertyAddress } : {}),
      ...fields,
    };
    // Our side's agents, only when the form carried them, and only after the
    // ids are confirmed to be this workspace's contacts.
    if (formData.has("primaryAgentContactId") || formData.has("coAgentContactId")) {
      const primary = optStr(formData, "primaryAgentContactId");
      const co = optStr(formData, "coAgentContactId");
      const ok = await safeContactIds(tx, [primary, co]);
      if (formData.has("primaryAgentContactId")) {
        data.primaryAgentContactId = primary ? (ok[primary] ?? null) : null;
      }
      if (formData.has("coAgentContactId")) {
        data.coAgentContactId = co ? (ok[co] ?? null) : null;
      }
    }
    // TC/assistant slots replace the file's assignment wholesale when the form
    // carries them: the two selects are the complete answer, so clearing one
    // has to actually unassign that person.
    if (formData.has("assigneeIds")) {
      const wanted = await safeAssigneeIds(tx, formData.getAll("assigneeIds").map(String));
      await tx.transactionAssignee.deleteMany({
        where: { transactionId: id, userId: { notIn: wanted.length > 0 ? wanted : ["-"] } },
      });
      const already = new Set(
        (
          await tx.transactionAssignee.findMany({
            where: { transactionId: id },
            select: { userId: true },
          })
        ).map((a) => a.userId),
      );
      const added = wanted.filter((u) => !already.has(u));
      if (added.length > 0) {
        await tx.transactionAssignee.createMany({
          data: added.map((userId) => ({ tenantId, transactionId: id, userId })),
        });
      }
    }
    if ("expectedFeeCents" in fields && fields.expectedFeeCents == null) {
      data.expectedFeeCents = await resolvedExpectedFee(tx, tenantId, fields.clientId, null);
    }
    const proposed = { ...((existing.proposedDates as Record<string, string> | null) ?? {}) };
    for (const field of GOVERNED_DATE_FIELDS) {
      // The rule itself lives in lib/governed-dates.ts, shared with the
      // inline Key dates editor so the two can't disagree about whether a
      // change to a contract date applies or raises an amendment.
      const decision = governedDateDecision(existing[field], fields[field]);
      if (decision.kind === "propose") {
        delete data[field];
        proposed[field] = decision.value;
        redirected.push(field);
        await raiseAmendmentTask(tx, {
          tenantId,
          transactionId: id,
          actorId: session.user.id,
          field,
          value: decision.value,
        });
      } else if (decision.kind === "noop") {
        delete data[field];
      }
      // "apply" leaves data[field] in place: anchored tasks get dated below.
    }
    if (redirected.length > 0) data.proposedDates = proposed;

    const updated = await tx.transaction.update({
      where: { id },
      data,
      select: ANCHOR_DATE_SELECT,
    });
    await recomputeAnchoredTasks(tx, id, updated);
  });
  if (closedNow) {
    firePostCloseEmail(tenantId, id, session.user);
    // The closing billing moment: draft whatever expected fee remains unbilled.
    await ensureAutoDraft(tenantId, id, "close");
  }

  if (redirected.length > 0) {
    logAudit({
      tenantId,
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "transaction.date_proposed",
      summary: `Date edit routed to proposal (${redirected.join(", ")}) — contract governs`,
      subjectType: "transaction",
      subjectId: id,
    });
  }
  logActivity({
    tenantId,
    transactionId: id,
    actor: session.user,
    action: "transaction.updated",
    summary: "Updated transaction details",
  });
  revalidatePath(`/dashboard/transactions/${id}`);
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard");
}

export async function setCustomField(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const key = str(formData, "key");
  if (!id || !key) return;
  const value = str(formData, "value");
  await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { customFields: true },
    });
    const fields = { ...((txn.customFields as Record<string, string> | null) ?? {}), [key]: value };
    await tx.transaction.update({ where: { id }, data: { customFields: fields } });
  });
  revalidatePath(`/dashboard/transactions/${id}`);
}

export async function removeCustomField(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const key = str(formData, "key");
  if (!id || !key) return;
  await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { customFields: true },
    });
    const fields = { ...((txn.customFields as Record<string, string> | null) ?? {}) };
    delete fields[key];
    await tx.transaction.update({ where: { id }, data: { customFields: fields } });
  });
  revalidatePath(`/dashboard/transactions/${id}`);
}

/**
 * Discard one entry from the extraction landing list — the coordinator
 * looked at what the contract-reader found and decided it isn't worth
 * turning into a real party. See lib/actions/parties.ts's linkExtractedParty
 * for the other outcome, which removes an entry from here the same way but
 * leaves a real TransactionParty in its place.
 */
export async function removeTransactionParty(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const role = str(formData, "role");
  const value = str(formData, "value");
  if (!id) return;
  await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { contractParties: true },
    });
    const parties = ((txn.contractParties as ContractParty[] | null) ?? []).filter(
      (p) => !(p.role === role && p.value === value),
    );
    await tx.transaction.update({
      where: { id },
      data: { contractParties: parties as unknown as Record<string, string>[] },
    });
  });
  revalidatePath(`/dashboard/transactions/${id}`);
}

/**
 * The required-documents checklist on the Documents tab. Slots are seeded when
 * an action plan is applied and can be added by hand; a slot is "received" once
 * a Document on the file is linked to it.
 */
export async function addRequiredDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const label = str(formData, "label");
  if (!id || !label) return;
  await withTenant(tenantId, async (tx) => {
    const max = await tx.transactionRequiredDocument.aggregate({
      where: { transactionId: id },
      _max: { sortOrder: true },
    });
    await tx.transactionRequiredDocument.create({
      data: { tenantId, transactionId: id, label, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
  });
  revalidatePath(`/dashboard/transactions/${id}`);
}

export async function removeRequiredDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const requiredId = str(formData, "requiredId");
  if (!id || !requiredId) return;
  await withTenant(tenantId, (tx) =>
    tx.transactionRequiredDocument.deleteMany({ where: { id: requiredId, transactionId: id } }),
  );
  revalidatePath(`/dashboard/transactions/${id}`);
}

/** Link (or, with an empty documentId, unlink) a document to a checklist slot. */
export async function setRequiredDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const requiredId = str(formData, "requiredId");
  if (!id || !requiredId) return;
  const documentId = optStr(formData, "documentId");
  await withTenant(tenantId, async (tx) => {
    // Only accept a document that actually lives on this transaction.
    if (documentId) {
      const doc = await tx.document.findFirst({
        where: { id: documentId, transactionId: id },
        select: { id: true },
      });
      if (!doc) return;
    }
    await tx.transactionRequiredDocument.updateMany({
      where: { id: requiredId, transactionId: id },
      data: { documentId },
    });
  });
  revalidatePath(`/dashboard/transactions/${id}`);
}

export async function deleteTransaction(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  const id = str(formData, "id");
  if (!id || !isAdmin || !confirmed(formData)) return;
  const { gone, docs } = await withTenant(tenantId, async (tx) => {
    // Row deletion cascades in Postgres, but the object storage behind each
    // row does not — collect what it was pointing at before it's gone, or
    // the bytes sit in the bucket forever with nothing left to name them.
    const docs = await tx.document.findMany({
      where: { transactionId: id },
      select: { storageKey: true, storageProvider: true, tenantId: true },
    });
    const gone = await tx.transaction.delete({
      where: { id },
      select: { propertyAddress: true },
    });
    return { gone, docs };
  });
  await Promise.all(docs.map((doc) => deleteObject({ ...doc, data: null })));
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "transaction.deleted",
    summary: `Deleted transaction "${gone.propertyAddress}"`,
    subjectType: "transaction",
    subjectId: id,
  });
  revalidatePath("/dashboard/transactions");
  redirect("/dashboard/transactions");
}

/**
 * Raise (or re-word) the "Amendment needed" task behind a proposed change to
 * a contract-governed date.
 *
 * Upserts on the open task for that field rather than creating one per edit:
 * moving a closing three times should leave one task naming the latest date,
 * not three competing ones.
 */
async function raiseAmendmentTask(
  tx: TenantTx,
  opts: {
    tenantId: string;
    transactionId: string;
    actorId: string;
    field: GovernedDateField;
    value: string;
  },
): Promise<void> {
  const title = amendmentTitle(opts.field, opts.value);
  const open = await tx.task.findFirst({
    where: { transactionId: opts.transactionId, proposedFor: opts.field, status: "OPEN" },
    select: { id: true },
  });
  if (open) {
    await tx.task.update({ where: { id: open.id }, data: { title } });
    return;
  }
  await tx.task.create({
    data: {
      tenantId: opts.tenantId,
      transactionId: opts.transactionId,
      title,
      priority: "HIGH",
      proposedFor: opts.field,
      dueDate: new Date(),
      assigneeId: opts.actorId,
    },
  });
}

/**
 * The transaction columns a plan task can be anchored to. Selecting exactly
 * this shape everywhere a recompute is triggered keeps the two in step: an
 * anchor added to the enum without a column here would silently stop
 * re-dating its tasks.
 */
const ANCHOR_DATE_SELECT = {
  contractDate: true,
  closeDate: true,
  listDate: true,
  expireDate: true,
  mortgageCommitmentDate: true,
  inspectionDeadlineDate: true,
  earnestMoneyDueDate: true,
} as const;

/** Whether a changed column is one that dates plan tasks. */
function isAnchorDateField(field: string): boolean {
  return Object.hasOwn(ANCHOR_DATE_SELECT, field);
}

/**
 * Domino recomputation: after an anchoring date actually changes, re-date
 * every open plan task that still follows its anchor. Manually re-dated
 * tasks (dueDateEdited) and completed tasks are left alone.
 *
 * Two anchors are deliberately never touched here:
 * - **DEPENDENCY** tasks are dated by the completion of the task they wait
 *   on. Moving the closing date must not reach in and re-date them — they
 *   were never following a transaction date in the first place.
 * - **TEMPLATE_START** was resolved once, from the day the plan was applied.
 *   That day doesn't change, so neither should the tasks that followed it.
 *
 * Both fall out of `anchorDate` returning undefined for an anchor with no
 * entry in what we pass it, but they're worth stating: before the extended
 * anchors existed this function treated "not CONTRACT_DATE" as "must be
 * CLOSE_DATE", which would have quietly dated dependency tasks off closing.
 */
async function recomputeAnchoredTasks(
  tx: TenantTx,
  transactionId: string,
  anchors: AnchorDates,
): Promise<number> {
  const tasks = await tx.task.findMany({
    where: {
      transactionId,
      status: "OPEN",
      dueDateEdited: false,
      anchor: { not: null, notIn: ["DEPENDENCY", "TEMPLATE_START"] },
    },
    select: { id: true, anchor: true, offsetDays: true },
  });
  let moved = 0;
  for (const t of tasks) {
    if (!t.anchor || t.offsetDays == null) continue;
    const base = anchorDate(t.anchor, anchors);
    if (!base) continue;
    const due = new Date(base.getTime());
    due.setUTCDate(due.getUTCDate() + t.offsetDays);
    await tx.task.update({ where: { id: t.id }, data: { dueDate: due } });
    moved++;
  }
  return moved;
}

const GOVERNED_FIELDS = ["closeDate", "contractDate"] as const;
type GovernedField = (typeof GOVERNED_FIELDS)[number];
const FIELD_LABEL: Record<GovernedField, string> = {
  closeDate: "closing date",
  contractDate: "contract date",
};

/**
 * The contract is the source of truth: a governed date is never changed
 * directly. Proposing a change records the intent and creates a high-priority
 * task to get the amendment executed; only confirming applies the date and
 * fires the domino recomputation.
 */
export async function proposeDateChange(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const field = str(formData, "field") as GovernedField;
  const dateRaw = str(formData, "proposedDate");
  if (!id || !GOVERNED_FIELDS.includes(field) || !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return;

  await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { proposedDates: true },
    });
    const proposed = { ...((txn.proposedDates as Record<string, string> | null) ?? {}) };
    proposed[field] = dateRaw;
    await tx.transaction.update({ where: { id }, data: { proposedDates: proposed } });
    const existing = await tx.task.findFirst({
      where: { transactionId: id, proposedFor: field, status: "OPEN" },
      select: { id: true },
    });
    if (existing) {
      await tx.task.update({
        where: { id: existing.id },
        data: { title: `Amendment needed: ${FIELD_LABEL[field]} → ${dateRaw}` },
      });
    } else {
      await tx.task.create({
        data: {
          tenantId,
          transactionId: id,
          title: `Amendment needed: ${FIELD_LABEL[field]} → ${dateRaw}`,
          priority: "HIGH",
          proposedFor: field,
          dueDate: new Date(),
          assigneeId: session.user.id,
        },
      });
    }
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "transaction.date_proposed",
    summary: `Proposed ${FIELD_LABEL[field]} change to ${dateRaw}`,
    subjectType: "transaction",
    subjectId: id,
  });
  revalidatePath(`/dashboard/transactions/${id}`);
  revalidatePath("/dashboard");
}

/** Amendment executed: apply the proposed date and re-date anchored tasks. */
export async function confirmDateChange(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const field = str(formData, "field") as GovernedField;
  if (!id || !GOVERNED_FIELDS.includes(field)) return;

  let summary = "";
  await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { proposedDates: true },
    });
    const proposed = (txn.proposedDates as Record<string, string> | null) ?? {};
    const value = proposed[field];
    if (!value) return;
    const newDate = new Date(`${value}T00:00:00Z`);
    const rest = { ...proposed };
    delete rest[field];
    const updated = await tx.transaction.update({
      where: { id },
      data: { [field]: newDate, proposedDates: rest },
      select: ANCHOR_DATE_SELECT,
    });
    const moved = await recomputeAnchoredTasks(tx, id, updated);
    await tx.task.updateMany({
      where: { transactionId: id, proposedFor: field, status: "OPEN" },
      data: { status: "DONE", completedAt: new Date() },
    });
    summary = `Confirmed ${FIELD_LABEL[field]} → ${value} (amendment executed); ${moved} task dates recomputed`;
  });
  if (summary) {
    logAudit({
      tenantId,
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "transaction.date_confirmed",
      summary,
      subjectType: "transaction",
      subjectId: id,
    });
  }
  revalidatePath(`/dashboard/transactions/${id}`);
  revalidatePath("/dashboard");
}

/** Withdraw a proposal: the contract stands as-is. */
export async function withdrawDateChange(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const field = str(formData, "field") as GovernedField;
  if (!id || !GOVERNED_FIELDS.includes(field)) return;
  await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { proposedDates: true },
    });
    const proposed = { ...((txn.proposedDates as Record<string, string> | null) ?? {}) };
    delete proposed[field];
    await tx.transaction.update({ where: { id }, data: { proposedDates: proposed } });
    await tx.task.updateMany({
      where: { transactionId: id, proposedFor: field, status: "OPEN" },
      data: { status: "SKIPPED" },
    });
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "transaction.date_withdrawn",
    summary: `Withdrew proposed ${FIELD_LABEL[field]} change`,
    subjectType: "transaction",
    subjectId: id,
  });
  revalidatePath(`/dashboard/transactions/${id}`);
  revalidatePath("/dashboard");
}
