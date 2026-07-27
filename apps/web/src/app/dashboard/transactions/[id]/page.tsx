import { PartyRole, prisma, TransactionSide, TransactionStatus, withTenant } from "@freehold/db";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityPanel } from "@/components/activity-panel";
import { Avatar } from "@/components/avatar";
import { Badge, EnvelopeBadge, ExtractionBadge } from "@/components/badges";
import { CcEmailPill } from "@/components/cc-email-pill";
import {
  ClosingDateCalendar,
  type DateMarker,
  type MarkerKind,
} from "@/components/closing-date-calendar";
import { DangerDelete } from "@/components/danger-delete";
import { DocumentDropZone } from "@/components/document-drop-zone";
import { LiveDictateButton } from "@/components/live-dictate-button";
import { VendorOrderTab } from "@/components/vendor-order-tab";
import { VisibilityToggles } from "@/components/visibility-toggles";
import { assignUser, unassignUser } from "@/lib/actions/assignees";
import {
  attachSlotDocument,
  reviewSlot,
  startRound,
  submitForReview,
} from "@/lib/actions/compliance";
import { enableProFeatures } from "@/lib/actions/credits";
import { deleteDocument, replaceDocument, uploadDocument } from "@/lib/actions/documents";
import { cancelScheduledEmail, sendTransactionEmail } from "@/lib/actions/emails";
import {
  deleteEnvelope,
  markEnvelopeSigned,
  refreshEnvelope,
  sendForSignature,
} from "@/lib/actions/esign";
import { runExtraction } from "@/lib/actions/extractions";
import {
  addTransactionCharge,
  createInvoice,
  deleteDraftInvoice,
  issueDraftInvoice,
  markInvoicePaid,
} from "@/lib/actions/invoices";
import { addParty, removeParty } from "@/lib/actions/parties";
import { setAssigneeFee } from "@/lib/actions/pay";
import { createPortalLink, deletePortalLink, setPortalLinkActive } from "@/lib/actions/portal";
import {
  applyActionPlan,
  createTask,
  cycleTaskPriority,
  deleteTask,
  toggleTask,
} from "@/lib/actions/tasks";
import { generateDocument } from "@/lib/actions/templates";
import {
  addRequiredDocument,
  addTransactionParty,
  confirmDateChange,
  deleteTransaction,
  proposeDateChange,
  removeCustomField,
  removeRequiredDocument,
  removeTransactionParty,
  setCustomField,
  setRequiredDocument,
  updatePayout,
  updateTransaction,
  withdrawDateChange,
} from "@/lib/actions/transactions";
import { type ContractParty, PARTY_LABEL, partyLabel } from "@/lib/ai/contract-schema";
import { transactionAlert } from "@/lib/alerts";
import { emailContextForTransaction, transactionMergeContext } from "@/lib/auto-emails";
import {
  displayState,
  type InvoiceDisplayState,
  invoiceMoney,
  LINE_KINDS,
  paidCents,
  transactionBilling,
} from "@/lib/billing";
import {
  SLOT_LABEL as COMPLIANCE_SLOT_LABEL,
  STATUS_LABEL as COMPLIANCE_STATUS_LABEL,
  STATUS_TONE as COMPLIANCE_STATUS_TONE,
  effectiveTier,
} from "@/lib/compliance";
import { emailEnabled } from "@/lib/email";
import { EMAIL_MERGE_CODES, parseEmailSettings, renderMerge } from "@/lib/email-template";
import { suggestForTask } from "@/lib/email-template-library";
import { fmtDate, fmtMoney, ROLE_LABEL, STATUS_LABEL } from "@/lib/format";
import { invoiceLabel, TERM_PRESETS } from "@/lib/invoicing";
import { gapForTransaction, gapMessage } from "@/lib/licensing";
import { fmtCents } from "@/lib/pay";
import { creditBalance, transactionHasPro } from "@/lib/plans";
import { portalOrigin } from "@/lib/portal";
import {
  PRIORITY_LABEL,
  priorityBadgeStyle,
  priorityColorStyle,
  rowHighlightStyle,
} from "@/lib/priority";
import { sideLabel, tenantSideLabels } from "@/lib/side-labels";
import {
  GUEST_ROLE,
  getMemberCompliance,
  getMemberRole,
  guestMaySeeTransaction,
  requireTenant,
} from "@/lib/tenant";
import { btn, btnGhost, card, input, label } from "@/lib/ui";

export const dynamic = "force-dynamic";

const STATUSES = Object.values(TransactionStatus);
const SIDES = Object.values(TransactionSide);
const ROLES = Object.values(PartyRole);

const TXN_TABS = [
  ["tasks", "Tasks"],
  ["documents", "Documents"],
  ["vendors", "Vendors"],
  ["billing", "Billing"],
  ["compliance", "Compliance"],
  ["dates", "Dates & details"],
  ["participants", "Participants"],
  ["emails", "Emails"],
  ["notes", "Notes"],
  ["payout", "Payout"],
  ["misc", "Portals & misc"],
] as const;
type TxnTab = (typeof TXN_TABS)[number][0];

export default async function TransactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    emailTemplate?: string;
    emailTask?: string;
    licenseError?: string;
  }>;
}) {
  const { tenantId, session } = await requireTenant({ allowGuest: true });
  const role = await getMemberRole(tenantId, session.user.id);
  const isAdmin = role === "owner" || role === "admin";
  const isGuest = role === GUEST_ROLE;
  const labels = await tenantSideLabels(tenantId);
  const { id } = await params;
  // A guest reaches only the files they were handed; anything else doesn't
  // exist as far as they're concerned.
  if (!(await guestMaySeeTransaction(tenantId, session.user.id, id))) notFound();
  const { tab: tabRaw, emailTemplate, emailTask, licenseError } = await searchParams;
  const tab: TxnTab = (TXN_TABS.some(([t]) => t === tabRaw) ? tabRaw : "tasks") as TxnTab;

  const data = await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUnique({
      where: { id },
      include: {
        client: true,
        invoices: { orderBy: { number: "desc" } },
        intakeSubmissions: { orderBy: { createdAt: "desc" } },
        parties: { include: { contact: true }, orderBy: { createdAt: "asc" } },
        requiredDocuments: {
          orderBy: { sortOrder: "asc" },
          include: { document: { select: { id: true, filename: true } } },
        },
        tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        documents: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            filename: true,
            contentType: true,
            sizeBytes: true,
            createdAt: true,
            visibleToAgent: true,
            visibleToClient: true,
            version: true,
            isCurrent: true,
            replacesId: true,
          },
        },
        compliance: {
          orderBy: { version: "desc" },
          include: {
            slots: {
              orderBy: { sortOrder: "asc" },
              include: { document: { select: { id: true, filename: true } } },
            },
          },
        },
        extractions: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { fields: true } } },
        },
        envelopes: {
          orderBy: { createdAt: "desc" },
          include: { document: { select: { filename: true } } },
        },
        assignees: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true, image: true } },
            // Present once billed — the fee then locks, since it's on a statement.
            paymentItem: { select: { feeCents: true, request: { select: { status: true } } } },
          },
        },
        portalLinks: { orderBy: { createdAt: "desc" } },
        emails: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!txn) return null;
    const [contacts, clients, plans, templates] = await Promise.all([
      tx.contact.findMany({ orderBy: { name: "asc" } }),
      tx.client.findMany({ orderBy: { name: "asc" } }),
      tx.actionPlan.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { tasks: true } } },
      }),
      tx.docTemplate.findMany({ orderBy: { name: "asc" } }),
    ]);
    const emailTemplates = await tx.emailTemplate.findMany({ orderBy: { name: "asc" } });
    return { txn, contacts, clients, plans, templates, emailTemplates };
  });
  if (!data) notFound();
  const { txn, contacts, clients, plans, templates, emailTemplates } = data;

  // Versioning: lists show current files only; each keeps a chain of the prior
  // versions it superseded (newest prior first), reached via replacesId.
  const docById = new Map(txn.documents.map((d) => [d.id, d]));
  const currentDocs = txn.documents.filter((d) => d.isCurrent);
  const priorVersions = (doc: (typeof txn.documents)[number]) => {
    const out: typeof txn.documents = [];
    let cur = doc.replacesId ? docById.get(doc.replacesId) : undefined;
    while (cur) {
      out.push(cur);
      cur = cur.replacesId ? docById.get(cur.replacesId) : undefined;
    }
    return out;
  };

  // Compliance: the current round drives the tab; older rounds stay as history.
  const currentRound = txn.compliance.find((c) => c.isCurrent) ?? null;
  const priorRounds = txn.compliance.filter((c) => !c.isCurrent);
  const member = await getMemberCompliance(tenantId, session.user.id);
  const reviewerTier = currentRound
    ? effectiveTier(member.role, member.complianceTier, currentRound.approvalLevels)
    : 0;
  const canReview = reviewerTier >= 1;
  const canSetFees = member.role === "owner" || member.role === "admin";

  // Workspace members for the assignment picker (auth table, not tenant-RLS).
  const workspaceMembers = await prisma.member.findMany({
    where: { organizationId: tenantId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Licensed-state check: shown as a banner under "warn", and the reason a
  // blocked write bounced back here.
  const gap = await withTenant(tenantId, (tx) => gapForTransaction(tx, txn.id));

  // Last-touched record + staleness verdict, computed by the same helper the
  // dashboard and the daily briefing use.
  const alert = await transactionAlert(tenantId, txn.id);

  // Money on this file: every invoice touching it (directly or via a line on
  // a consolidated invoice), and the attributed billed/paid totals. Hidden
  // from guests — outside coverage staff work the file, not the money.
  const billingInvoices = isGuest
    ? []
    : await withTenant(tenantId, (tx) =>
        tx.invoice.findMany({
          where: { OR: [{ transactionId: id }, { lines: { some: { transactionId: id } } }] },
          orderBy: { number: "desc" },
          include: {
            client: { select: { name: true } },
            lines: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                transactionId: true,
                kind: true,
                description: true,
                amountCents: true,
              },
            },
            payments: { select: { amountCents: true } },
          },
        }),
      );
  const fileMoney = transactionBilling(txn.id, billingInvoices);
  const stillDueCents = fileMoney.billedCents - fileMoney.paidCents;
  // Money already sitting on unissued drafts counts against "left to draft" —
  // the quick button must never stack a second helping of the same fee.
  const draftedCents = billingInvoices
    .filter((i) => i.status === "DRAFT")
    .reduce(
      (s, i) =>
        s +
        i.lines.reduce(
          (t, l) => t + ((l.transactionId ?? i.transactionId) === txn.id ? l.amountCents : 0),
          0,
        ),
      0,
    );
  const remainingToBillCents =
    txn.expectedFeeCents != null ? Math.max(0, txn.expectedFeeCents - fileMoney.billedCents) : null;
  const remainingToDraftCents =
    remainingToBillCents != null ? Math.max(0, remainingToBillCents - draftedCents) : null;

  const portalBase = await portalOrigin(tenantId);
  // Pro-AI state for this transaction: proActive = may use AI here (paid plan,
  // self-host, or a Free workspace that spent a credit on it); credits = the
  // workspace balance available to turn it on.
  const [proActive, credits] = await Promise.all([
    transactionHasPro(tenantId, txn.proFeaturesEnabled),
    creditBalance(tenantId),
  ]);

  // Template-driven compose prefill: merge fields render server-side so the
  // TC sees (and can edit) the final text before sending.
  const emailTaskTitle = emailTask ? txn.tasks.find((t) => t.id === emailTask)?.title : undefined;
  const { suggested: suggestedTemplates, rest: restTemplates } = suggestForTask(
    emailTemplates,
    emailTaskTitle,
  );
  const scheduledEmails = await prisma.emailOutbox.findMany({
    where: { tenantId, transactionId: txn.id, sentAt: null, canceledAt: null },
    orderBy: { sendAt: "asc" },
  });
  const attachPrechecked = new Set<string>();
  let composeSubject = "";
  let composeBody = "";
  const selectedEmailTemplate = emailTemplate
    ? emailTemplates.find((t) => t.id === emailTemplate)
    : undefined;
  if (selectedEmailTemplate) {
    const ctx = await emailContextForTransaction(tenantId, txn.id, session.user);
    const task = emailTask ? txn.tasks.find((t) => t.id === emailTask) : undefined;
    const merge = ctx
      ? {
          ...transactionMergeContext(ctx, session.user),
          task_title: task?.title ?? "",
          task_due: task?.dueDate ? fmtDate(task.dueDate) : "",
        }
      : {};
    for (const d of currentDocs) {
      const keywords = (selectedEmailTemplate.attachMatch ?? "")
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
      if (keywords.some((k) => d.filename.toLowerCase().includes(k))) {
        attachPrechecked.add(d.id);
      }
    }
    composeSubject = renderMerge(selectedEmailTemplate.subject, merge);
    composeBody = renderMerge(selectedEmailTemplate.body, merge);
  }

  const customFields = (txn.customFields as Record<string, string> | null) ?? {};
  const contractParties = (txn.contractParties as ContractParty[] | null) ?? [];
  const today = fmtDate(new Date());
  const openCount = txn.tasks.filter((t) => t.status === "OPEN").length;

  // Workspace CC address (copy-to-clipboard pill in the header).
  const orgEmail = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { emailSettings: true },
  });
  const ccEmail = parseEmailSettings(orgEmail?.emailSettings).cc ?? "";

  // Key dates for the header calendar popover: contract, close, listing dates,
  // and every open deadline task.
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const closeIso = iso(txn.closeDate);
  const dateMarkers: DateMarker[] = [];
  const addMarker = (d: Date | null, label: string, kind: MarkerKind) => {
    const key = iso(d);
    if (key) dateMarkers.push({ date: key, label, kind });
  };
  addMarker(txn.contractDate, "Contract date", "contract");
  addMarker(txn.closeDate, "Closing", "close");
  addMarker(txn.mortgageCommitmentDate, "Mortgage commitment", "deadline");
  addMarker(txn.inspectionDeadlineDate, "Inspection deadline", "deadline");
  addMarker(txn.listDate, "List date", "other");
  addMarker(txn.onMarketDate, "On market", "other");
  addMarker(txn.expireDate, "Listing expires", "other");
  for (const t of txn.tasks) {
    if (t.dueDate && t.status !== "DONE") {
      dateMarkers.push({ date: iso(t.dueDate) as string, label: t.title, kind: "deadline" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/transactions" className="text-sm text-stone-500 hover:underline">
            ← Transactions
          </Link>
          <h1 className="text-xl font-semibold">{txn.propertyAddress}</h1>
          <p className="text-sm text-stone-500">
            {[txn.city, txn.state, txn.zip].filter(Boolean).join(", ") || "No location set"} ·{" "}
            {sideLabel(txn.side, labels)} · contract {fmtMoney(txn.purchasePrice)} · list{" "}
            {fmtMoney(txn.listPrice)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ClosingDateCalendar closeDate={closeIso} markers={dateMarkers} />
          {ccEmail ? (
            <CcEmailPill email={ccEmail} />
          ) : (
            <Link
              href="/dashboard/emails"
              className="rounded-lg border border-dashed border-stone-300 px-3 py-1.5 text-sm text-stone-400 transition hover:border-stone-400 hover:text-stone-500"
            >
              + CC email
            </Link>
          )}
          {!isGuest && (
            <Link
              href={`/dashboard/transactions/${txn.id}?tab=billing`}
              title="Billing for this file"
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm shadow-xs transition hover:border-stone-300 hover:bg-stone-50"
            >
              {fileMoney.billedCents > 0 ? (
                <>
                  <span className="text-stone-500">Billed</span>
                  <span className="tabular-nums font-medium text-stone-800">
                    {fmtCents(fileMoney.billedCents)}
                  </span>
                  <span className="text-stone-300">·</span>
                  {stillDueCents > 0 ? (
                    <span className="tabular-nums font-medium text-amber-700">
                      {fmtCents(stillDueCents)} due
                    </span>
                  ) : (
                    <span className="font-medium text-brand-700">paid</span>
                  )}
                </>
              ) : txn.expectedFeeCents == null ? (
                <span className="text-stone-400">Billing — fee not set</span>
              ) : txn.expectedFeeCents === 0 ? (
                <span className="text-stone-400">No charge</span>
              ) : (
                <>
                  <span className="text-stone-500">Unbilled</span>
                  <span className="tabular-nums font-medium text-amber-700">
                    {fmtCents(txn.expectedFeeCents)}
                  </span>
                </>
              )}
            </Link>
          )}
        </div>
      </div>

      {alert && <ActivityPanel alert={alert} />}

      {licenseError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          Not saved — {licenseError}
        </p>
      )}
      {!licenseError && gap && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Warning size={14} weight="fill" className="mr-1 inline text-amber-600" aria-hidden />
          {gapMessage(gap)}{" "}
          <Link
            href={`/dashboard/transactions/${txn.id}?tab=participants`}
            className="font-medium text-brand-700 underline"
          >
            Assign someone
          </Link>
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 xl:order-1">
          <section className={card}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-400">
              Key dates
            </h2>
            <dl className="flex flex-col gap-1.5 text-sm">
              {(
                [
                  ["List date", txn.listDate],
                  ["On market", txn.onMarketDate],
                  ["Contract", txn.contractDate],
                  ["Close", txn.closeDate],
                  ["Mortgage commitment", txn.mortgageCommitmentDate],
                  ["Inspection deadline", txn.inspectionDeadlineDate],
                  ["Expires", txn.expireDate],
                ] as const
              ).map(([labelText, d]) => (
                <div key={labelText} className="flex justify-between gap-2">
                  <dt className="text-stone-500">{labelText}</dt>
                  <dd className="tabular-nums font-medium">{fmtDate(d)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className={card}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-400">
              Next deadlines
            </h2>
            <ul className="flex flex-col gap-1.5 text-sm">
              {txn.tasks
                .filter((t) => t.status === "OPEN" && t.dueDate)
                .slice(0, 6)
                .map((t) => (
                  <li key={t.id} className="flex justify-between gap-2">
                    <span className="truncate">{t.title}</span>
                    <span className="shrink-0 tabular-nums text-stone-400">
                      {fmtDate(t.dueDate)}
                    </span>
                  </li>
                ))}
              {txn.tasks.filter((t) => t.status === "OPEN" && t.dueDate).length === 0 && (
                <li className="text-stone-400">Nothing dated is open.</li>
              )}
            </ul>
          </section>
          <section className={card}>
            <details open>
              <summary className="cursor-pointer select-none text-sm font-semibold uppercase tracking-wide text-stone-400">
                Listing details
              </summary>
              <dl className="mt-2 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-500">MLS ID</dt>
                  <dd className="font-medium">{txn.mlsId ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-500">List price</dt>
                  <dd className="tabular-nums font-medium">{fmtMoney(txn.listPrice)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-500">Contract price</dt>
                  <dd className="tabular-nums font-medium">{fmtMoney(txn.purchasePrice)}</dd>
                </div>
              </dl>
            </details>
          </section>
          <section className={card}>
            <h2 className="mb-1 font-medium">Parties</h2>
            <p className="mb-3 text-xs text-stone-400">
              Pulled from the contract, or add your own. Permanent — these won't be dropped like a
              custom field.
            </p>
            {contractParties.length > 0 ? (
              <ul className="mb-3 flex flex-col divide-y divide-stone-100">
                {contractParties.map((p) => (
                  <li
                    key={`${p.role}:${p.value}`}
                    className="group flex items-start gap-2 py-1.5 text-sm"
                  >
                    <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-stone-400">
                      {partyLabel(p.role)}
                    </span>
                    <span className="min-w-0 flex-1 text-stone-800">{p.value}</span>
                    <form action={removeTransactionParty}>
                      <input type="hidden" name="id" value={txn.id} />
                      <input type="hidden" name="role" value={p.role} />
                      <input type="hidden" name="value" value={p.value} />
                      <button
                        type="submit"
                        aria-label={`Remove ${partyLabel(p.role)}`}
                        className="text-xs text-stone-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm text-stone-400">
                No parties yet — they fill in when you apply a contract extraction.
              </p>
            )}
            <form action={addTransactionParty} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={txn.id} />
              <label className={label}>
                Role
                <select name="role" defaultValue="buyer" className={input}>
                  {Object.entries(PARTY_LABEL).map(([role, lbl]) => (
                    <option key={role} value={role}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Name
                <input name="value" placeholder="Jane Buyer" className={input} />
              </label>
              <button type="submit" className={btnGhost}>
                Add party
              </button>
            </form>
          </section>
          <section className={card}>
            <h2 className="mb-1 font-medium">Custom fields</h2>
            <p className="mb-3 text-xs text-stone-400">
              Any field works in document templates as{" "}
              <code className="font-mono">{"{{field_key}}"}</code>.
            </p>
            {Object.keys(customFields).length > 0 && (
              <ul className="mb-3 flex flex-col gap-1">
                {Object.entries(customFields).map(([k, v]) => (
                  <li key={k} className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{k}:</span> <span>{v}</span>
                    <form action={removeCustomField}>
                      <input type="hidden" name="id" value={txn.id} />
                      <input type="hidden" name="key" value={k} />
                      <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                        remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={setCustomField} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={txn.id} />
              <label className={label}>
                Field
                <input name="key" placeholder="MLS #" className={input} />
              </label>
              <label className={label}>
                Value
                <input name="value" placeholder="MLS-102938" className={input} />
              </label>
              <button type="submit" className={btnGhost}>
                Add field
              </button>
            </form>
          </section>
        </aside>
        <div className="flex min-w-0 flex-col gap-3 xl:order-2">
          <nav className="flex flex-wrap gap-1 border-b border-stone-200">
            {TXN_TABS.filter(([key]) => !(isGuest && key === "billing")).map(([key, labelText]) => (
              <Link
                key={key}
                href={`/dashboard/transactions/${txn.id}?tab=${key}`}
                aria-current={tab === key ? "page" : undefined}
                className={`rounded-t-lg px-3 py-2 text-sm transition-colors ${
                  tab === key
                    ? "border border-b-0 border-stone-200 bg-white font-medium text-brand-800"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {labelText}
              </Link>
            ))}
          </nav>
          {tab === "tasks" && (
            <section className={card}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-medium">
                  Tasks <span className="text-sm text-stone-400">({openCount} open)</span>
                </h2>
                {plans.length > 0 && (
                  <form action={applyActionPlan} className="flex items-center gap-2">
                    <input type="hidden" name="transactionId" value={txn.id} />
                    <select name="planId" className={input} defaultValue={plans[0]?.id}>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p._count.tasks})
                        </option>
                      ))}
                    </select>
                    <button type="submit" className={btnGhost}>
                      Apply plan
                    </button>
                  </form>
                )}
              </div>
              {txn.tasks.length === 0 ? (
                <p className="mb-3 text-sm text-stone-500">
                  No tasks yet — add one below or apply an action plan.
                </p>
              ) : (
                <ul className="mb-4 flex flex-col">
                  {txn.tasks.map((t) => {
                    const done = t.status === "DONE";
                    const overdue = !done && t.dueDate && fmtDate(t.dueDate) < today;
                    return (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 border-b border-stone-100 px-1 py-2 last:border-0"
                        style={rowHighlightStyle(t.priority)}
                      >
                        <form action={toggleTask}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="transactionId" value={txn.id} />
                          <button
                            type="submit"
                            title={done ? "Reopen" : "Mark done"}
                            className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                              done
                                ? "border-brand-600 bg-brand-600 text-white"
                                : "border-stone-300 hover:border-brand-600"
                            }`}
                          >
                            {done ? "✓" : ""}
                          </button>
                        </form>
                        <span
                          className={`w-24 shrink-0 text-sm ${overdue ? "font-medium text-red-600" : "text-stone-500"}`}
                        >
                          {fmtDate(t.dueDate)}
                        </span>
                        <span className={`text-sm ${done ? "text-stone-400 line-through" : ""}`}>
                          {t.title}
                        </span>
                        {PRIORITY_LABEL[t.priority] && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={priorityBadgeStyle(t.priority)}
                          >
                            {PRIORITY_LABEL[t.priority]}
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-3">
                          <Link
                            href={`/dashboard/transactions/${txn.id}?tab=emails&emailTask=${t.id}${t.emailTemplateId ? `&emailTemplate=${t.emailTemplateId}` : ""}`}
                            title={
                              t.emailTemplateId
                                ? "Send this task's email — template ready"
                                : "Send an email about this task — templates available"
                            }
                            className={
                              t.emailTemplateId
                                ? "text-brand-600 transition-colors hover:text-brand-700"
                                : "text-stone-300 transition-colors hover:text-brand-700"
                            }
                          >
                            ✉
                          </Link>
                          <form action={cycleTaskPriority}>
                            <input type="hidden" name="id" value={t.id} />
                            <input type="hidden" name="transactionId" value={txn.id} />
                            <button
                              type="submit"
                              title={`Priority: ${t.priority.toLowerCase()} — click to change`}
                              className={
                                t.priority === "NORMAL" ? "text-stone-300 hover:text-amber-500" : ""
                              }
                              style={priorityColorStyle(t.priority)}
                            >
                              ⚑
                            </button>
                          </form>
                          <VisibilityToggles
                            kind="task"
                            id={t.id}
                            transactionId={txn.id}
                            visibleToAgent={t.visibleToAgent}
                            visibleToClient={t.visibleToClient}
                          />
                        </span>
                        <div>
                          <DangerDelete
                            compact
                            action={deleteTask}
                            label="Delete"
                            description="Removes this task from the checklist."
                            hidden={{ id: t.id, transactionId: txn.id }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <form action={createTask} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="transactionId" value={txn.id} />
                <label className={`${label} min-w-64 flex-1`}>
                  New task
                  <input name="title" placeholder="Order home warranty" className={input} />
                </label>
                <label className={label}>
                  Due
                  <input name="dueDate" type="date" className={input} />
                </label>
                <button type="submit" className={btnGhost}>
                  Add task
                </button>
              </form>
            </section>
          )}
          {tab === "documents" && (
            <div className="flex flex-col gap-4">
              <DocumentDropZone transactionId={txn.id} linkAction={setRequiredDocument} />
              <section className={card}>
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="font-medium">Required documents</h2>
                  {txn.requiredDocuments.length > 0 && (
                    <span className="text-sm text-stone-400">
                      {txn.requiredDocuments.filter((r) => r.document).length} of{" "}
                      {txn.requiredDocuments.length} received
                    </span>
                  )}
                </div>
                <p className="mb-3 text-sm text-stone-500">
                  The checklist for this file. Apply an action plan to fill it, or add your own.
                  Attach an uploaded document to mark a slot received.
                </p>
                {txn.requiredDocuments.length === 0 ? (
                  <p className="mb-3 text-sm text-stone-400">
                    Nothing required yet — apply an action plan, or add one below.
                  </p>
                ) : (
                  <ul className="mb-3 flex flex-col divide-y divide-stone-100">
                    {txn.requiredDocuments.map((req) => (
                      <li key={req.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                        <span
                          aria-hidden
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${
                            req.document
                              ? "bg-brand-600 text-white"
                              : "border border-dashed border-stone-300 text-stone-300"
                          }`}
                        >
                          {req.document ? "✓" : ""}
                        </span>
                        <span className={`font-medium ${req.document ? "" : "text-stone-600"}`}>
                          {req.label}
                        </span>
                        {req.document ? (
                          <>
                            <a
                              href={`/api/documents/${req.document.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-600 hover:underline"
                            >
                              {req.document.filename}
                            </a>
                            <form action={setRequiredDocument} className="ml-auto">
                              <input type="hidden" name="id" value={txn.id} />
                              <input type="hidden" name="requiredId" value={req.id} />
                              <input type="hidden" name="documentId" value="" />
                              <button
                                type="submit"
                                className="text-xs text-stone-400 hover:text-stone-700"
                              >
                                detach
                              </button>
                            </form>
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-medium uppercase tracking-wide text-amber-600">
                              Missing
                            </span>
                            {currentDocs.length > 0 && (
                              <form
                                action={setRequiredDocument}
                                className="ml-auto flex items-center gap-1"
                              >
                                <input type="hidden" name="id" value={txn.id} />
                                <input type="hidden" name="requiredId" value={req.id} />
                                <select
                                  name="documentId"
                                  defaultValue=""
                                  className={`${input} py-1 text-xs`}
                                >
                                  <option value="" disabled>
                                    Attach a file…
                                  </option>
                                  {currentDocs.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.filename}
                                    </option>
                                  ))}
                                </select>
                                <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                                  Attach
                                </button>
                              </form>
                            )}
                          </>
                        )}
                        <form action={removeRequiredDocument}>
                          <input type="hidden" name="id" value={txn.id} />
                          <input type="hidden" name="requiredId" value={req.id} />
                          <button
                            type="submit"
                            aria-label={`Remove ${req.label} from the checklist`}
                            className="text-xs text-stone-300 hover:text-red-600"
                          >
                            ✕
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={addRequiredDocument} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={txn.id} />
                  <label className={`${label} min-w-56 flex-1`}>
                    Add a required document
                    <input
                      name="label"
                      required
                      placeholder="Lead paint disclosure"
                      className={input}
                    />
                  </label>
                  <button type="submit" className={btnGhost}>
                    Add
                  </button>
                </form>
              </section>

              <section className={card}>
                <h2 className="mb-1 flex items-center gap-2 font-medium">
                  Documents &amp; contract extraction
                  {txn.proFeaturesEnabled && (
                    <span className="rounded-full bg-brand-600/10 px-2 py-0.5 text-xs font-medium text-brand-700">
                      Pro AI on
                    </span>
                  )}
                </h2>
                <p className="mb-3 text-sm text-stone-500">
                  Upload the purchase contract and let AI pull every key date and figure —
                  page-cited, and nothing is saved until you confirm it.
                </p>
                {!proActive && (
                  <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2.5">
                    <p className="text-sm font-medium text-brand-900">
                      Pro AI is off for this transaction
                    </p>
                    <p className="mt-0.5 text-xs text-brand-800">
                      Turn it on to extract contract data, auto-classify dropped documents, and
                      dictate here. It stays on for this transaction.
                    </p>
                    <div className="mt-2">
                      {credits > 0 ? (
                        <form action={enableProFeatures}>
                          <input type="hidden" name="transactionId" value={txn.id} />
                          <button type="submit" className={btn}>
                            Enable pro features · 1 credit ({credits} left)
                          </button>
                        </form>
                      ) : (
                        <Link href="/dashboard/billing" className={btn}>
                          Buy credits to enable
                        </Link>
                      )}
                    </div>
                  </div>
                )}
                {!process.env.ANTHROPIC_API_KEY && (
                  <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    No <code>ANTHROPIC_API_KEY</code> is configured — extraction runs will fail
                    until one is added to <code>.env</code>.
                  </p>
                )}
                {currentDocs.length > 0 && (
                  <ul className="mb-4 flex flex-col">
                    {currentDocs.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex flex-wrap items-center gap-3 border-b border-stone-100 py-2 last:border-0"
                      >
                        <a
                          href={`/api/documents/${doc.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {doc.filename}
                        </a>
                        {doc.version > 1 && (
                          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-medium text-stone-500">
                            v{doc.version}
                          </span>
                        )}
                        <span className="text-xs text-stone-400">
                          {(doc.sizeBytes / 1024).toFixed(0)} KB · {fmtDate(doc.createdAt)}
                        </span>
                        {doc.contentType === "application/pdf" &&
                          (proActive ? (
                            <form action={runExtraction} className="flex items-center gap-2">
                              <input type="hidden" name="documentId" value={doc.id} />
                              <button type="submit" className={btnGhost}>
                                Extract contract data
                              </button>
                            </form>
                          ) : (
                            <span className="rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs text-stone-500">
                              Enable pro features to extract
                            </span>
                          ))}
                        <span className="ml-auto flex items-center gap-3">
                          <VisibilityToggles
                            kind="document"
                            id={doc.id}
                            transactionId={txn.id}
                            visibleToAgent={doc.visibleToAgent}
                            visibleToClient={doc.visibleToClient}
                          />
                        </span>
                        <div>
                          <DangerDelete
                            compact
                            action={deleteDocument}
                            label="Delete"
                            description="Permanently deletes this file."
                            hidden={{ id: doc.id, transactionId: txn.id }}
                          />
                        </div>
                        <details className="w-full">
                          <summary className="cursor-pointer select-none text-xs font-medium text-brand-700 transition-colors marker:text-brand-600 hover:text-brand-600">
                            Send for signature
                          </summary>
                          <form
                            action={sendForSignature}
                            className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-stone-50 p-3"
                          >
                            <input type="hidden" name="documentId" value={doc.id} />
                            <label className={label}>
                              Signer 1 name *
                              <input name="signer1Name" required className={input} />
                            </label>
                            <label className={label}>
                              Signer 1 email *
                              <input name="signer1Email" type="email" required className={input} />
                            </label>
                            <label className={label}>
                              Signer 2 name
                              <input name="signer2Name" className={input} />
                            </label>
                            <label className={label}>
                              Signer 2 email
                              <input name="signer2Email" type="email" className={input} />
                            </label>
                            <button type="submit" className={btnGhost}>
                              Send
                            </button>
                          </form>
                        </details>
                        <details className="w-full">
                          <summary className="cursor-pointer select-none text-xs font-medium text-brand-700 transition-colors marker:text-brand-600 hover:text-brand-600">
                            Replace with a new version
                          </summary>
                          <form
                            action={replaceDocument}
                            className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-stone-50 p-3"
                          >
                            <input type="hidden" name="id" value={doc.id} />
                            <label className={label}>
                              New file (PDF, max 10 MB)
                              <input
                                name="file"
                                type="file"
                                accept="application/pdf,.pdf"
                                required
                                className={input}
                              />
                            </label>
                            <button type="submit" className={btnGhost}>
                              Replace
                            </button>
                            <span className="pb-2 text-xs text-stone-400">
                              The current file becomes a prior version — nothing is lost.
                            </span>
                          </form>
                        </details>
                        {priorVersions(doc).length > 0 && (
                          <details className="w-full">
                            <summary className="cursor-pointer select-none text-xs text-stone-500 transition-colors hover:text-stone-700">
                              {priorVersions(doc).length} prior version
                              {priorVersions(doc).length === 1 ? "" : "s"}
                            </summary>
                            <ul className="mt-1.5 flex flex-col gap-1 border-l-2 border-stone-200 pl-3">
                              {priorVersions(doc).map((p) => (
                                <li
                                  key={p.id}
                                  className="flex flex-wrap items-center gap-2 text-xs"
                                >
                                  <span className="rounded bg-stone-100 px-1.5 py-0.5 font-medium text-stone-500">
                                    v{p.version}
                                  </span>
                                  <a
                                    href={`/api/documents/${p.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-stone-500 hover:text-brand-600 hover:underline"
                                  >
                                    {p.filename}
                                  </a>
                                  <span className="text-stone-400">
                                    {(p.sizeBytes / 1024).toFixed(0)} KB · replaced{" "}
                                    {fmtDate(p.createdAt)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <form action={uploadDocument} className="mb-4 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="transactionId" value={txn.id} />
                  <label className={label}>
                    Upload document (PDF, max 10 MB)
                    <input
                      name="file"
                      type="file"
                      accept="application/pdf,.pdf"
                      required
                      className={input}
                    />
                  </label>
                  <button type="submit" className={btnGhost}>
                    Upload
                  </button>
                </form>
                {templates.length > 0 && (
                  <form action={generateDocument} className="mb-4 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="transactionId" value={txn.id} />
                    <label className={label}>
                      Generate from template
                      <select name="templateId" className={input} defaultValue={templates[0]?.id}>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className={btnGhost}>
                      Generate PDF
                    </button>
                  </form>
                )}
                {txn.envelopes.length > 0 && (
                  <div className="mb-4">
                    <h3 className="mb-1 text-sm font-medium text-stone-600">Signature envelopes</h3>
                    <ul className="flex flex-col">
                      {txn.envelopes.map((env) => {
                        const signers =
                          (env.signers as Array<{ name: string; email: string }>) ?? [];
                        return (
                          <li
                            key={env.id}
                            className="flex flex-wrap items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                          >
                            <EnvelopeBadge status={env.status} />
                            <span className="font-medium">{env.document.filename}</span>
                            <span className="text-stone-500">
                              {env.provider.toLowerCase()} · {signers.map((s) => s.name).join(", ")}
                            </span>
                            {env.error && <span className="text-xs text-red-600">{env.error}</span>}
                            <span className="ml-auto flex items-center gap-2">
                              {env.provider === "MANUAL" && env.status === "SENT" && (
                                <form action={markEnvelopeSigned}>
                                  <input type="hidden" name="id" value={env.id} />
                                  <button type="submit" className={btnGhost}>
                                    Mark signed
                                  </button>
                                </form>
                              )}
                              {env.provider !== "MANUAL" && env.externalId && (
                                <form action={refreshEnvelope}>
                                  <input type="hidden" name="id" value={env.id} />
                                  <button type="submit" className={btnGhost}>
                                    Refresh status
                                  </button>
                                </form>
                              )}
                              <DangerDelete
                                compact
                                action={deleteEnvelope}
                                label="Delete"
                                description="Removes this signature record (the provider envelope is not cancelled)."
                                hidden={{ id: env.id, transactionId: txn.id }}
                              />
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {txn.extractions.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-sm font-medium text-stone-600">Extraction runs</h3>
                    <ul className="flex flex-col">
                      {txn.extractions.map((ex) => (
                        <li
                          key={ex.id}
                          className="flex items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                        >
                          <ExtractionBadge status={ex.status} />
                          <span className="text-stone-500">
                            {fmtDate(ex.createdAt)} · {ex._count.fields} fields · {ex.model}
                          </span>
                          <Link
                            href={`/dashboard/transactions/${txn.id}/extractions/${ex.id}`}
                            className="ml-auto text-brand-600 hover:underline"
                          >
                            {ex.status === "READY" ? "Review & apply" : "View"}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          )}
          {tab === "vendors" && <VendorOrderTab tenantId={tenantId} transactionId={id} />}
          {tab === "billing" && !isGuest && (
            <div className="flex flex-col gap-3">
              <section className={card}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="font-medium">Billing</h2>
                  <Link
                    href={`/dashboard/transactions/${txn.id}?tab=dates`}
                    className="text-xs text-brand-700 hover:underline"
                  >
                    {txn.expectedFeeCents == null
                      ? "Set the expected fee →"
                      : "Edit expected fee →"}
                  </Link>
                </div>
                {/* The ledger strip: the four numbers a TC needs to trust a file. */}
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {(
                    [
                      [
                        "Expected",
                        txn.expectedFeeCents == null
                          ? "—"
                          : txn.expectedFeeCents === 0
                            ? "No charge"
                            : fmtCents(txn.expectedFeeCents),
                        "text-stone-800",
                      ],
                      ["Billed", fmtCents(fileMoney.billedCents), "text-stone-800"],
                      [
                        "Paid",
                        fmtCents(fileMoney.paidCents),
                        fileMoney.paidCents > 0 ? "text-brand-700" : "text-stone-800",
                      ],
                      [
                        "Still due",
                        fmtCents(Math.max(0, stillDueCents)),
                        stillDueCents > 0 ? "text-amber-700" : "text-stone-800",
                      ],
                    ] as const
                  ).map(([labelText, value, tone], i) => (
                    <div
                      key={labelText}
                      className={`flex flex-col ${i === 0 ? "" : "border-l border-stone-200 pl-6"}`}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                        {labelText}
                      </span>
                      <span className={`tabular-nums text-lg font-semibold ${tone}`}>{value}</span>
                    </div>
                  ))}
                </div>
                {(() => {
                  const base = Math.max(txn.expectedFeeCents ?? 0, fileMoney.billedCents);
                  if (base <= 0) return null;
                  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / base) * 100))}%`;
                  return (
                    <div className="mt-3">
                      <div className="relative h-1.5 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-stone-300"
                          style={{ width: pct(fileMoney.billedCents) }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-brand-600"
                          style={{ width: pct(fileMoney.paidCents) }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-stone-400">
                        {fmtCents(fileMoney.paidCents)} collected of {fmtCents(base)}{" "}
                        {txn.expectedFeeCents != null && txn.expectedFeeCents > 0
                          ? "expected"
                          : "billed"}
                        {remainingToBillCents != null && remainingToBillCents > 0 && (
                          <span className="text-amber-700">
                            {" "}
                            · {fmtCents(remainingToBillCents)} not yet invoiced
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })()}
              </section>

              <section className={card}>
                <h2 className="mb-1 font-medium">Invoices on this file</h2>
                {billingInvoices.length === 0 ? (
                  <p className="text-sm text-stone-500">
                    Nothing billed on this file yet — draft the fee below, or add a charge.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-stone-100">
                    {billingInvoices.map((inv) => {
                      const money = invoiceMoney(inv.lines, inv.payments);
                      const state = displayState(inv.status, money);
                      const paidShown =
                        inv.provider !== "freehold" && inv.status === "PAID"
                          ? money.totalCents
                          : paidCents(inv.payments);
                      const attributed = inv.lines.reduce(
                        (t, l) =>
                          t +
                          ((l.transactionId ?? inv.transactionId) === txn.id ? l.amountCents : 0),
                        0,
                      );
                      const stateBadge: Record<
                        InvoiceDisplayState,
                        ["success" | "danger" | "progress" | "neutral", string]
                      > = {
                        draft: ["neutral", "Draft"],
                        unpaid: ["progress", "Unpaid"],
                        partial: ["progress", "Partly paid"],
                        paid: ["success", "Paid"],
                        void: ["neutral", "Void"],
                      };
                      const [tone, stateText] = stateBadge[state];
                      return (
                        <li key={inv.id} className="py-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="font-medium">{invoiceLabel(inv.number)}</span>
                            <Badge tone={tone}>{stateText}</Badge>
                            {inv.client && (
                              <span className="text-xs text-stone-400">{inv.client.name}</span>
                            )}
                            {attributed !== money.totalCents && (
                              <span className="text-xs text-stone-400">
                                this file's share {fmtCents(attributed)}
                              </span>
                            )}
                            <span className="ml-auto flex items-baseline gap-3 tabular-nums">
                              <span className="font-medium">{fmtCents(money.totalCents)}</span>
                              {paidShown > 0 && (
                                <span className="text-xs text-brand-700">
                                  {fmtCents(paidShown)} paid
                                </span>
                              )}
                              {state !== "void" &&
                                state !== "draft" &&
                                money.totalCents - paidShown > 0 && (
                                  <span className="text-xs text-amber-700">
                                    {fmtCents(money.totalCents - paidShown)} due
                                  </span>
                                )}
                            </span>
                          </div>
                          {inv.lines.length > 1 && (
                            <ul className="mt-1 flex flex-col gap-0.5 border-l-2 border-stone-100 pl-3">
                              {inv.lines.map((l) => (
                                <li key={l.id} className="flex gap-3 text-xs text-stone-500">
                                  <span>{l.description}</span>
                                  <span className="ml-auto tabular-nums">
                                    {fmtCents(l.amountCents)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {isAdmin && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-3">
                              <a
                                href={`/api/invoices/${inv.id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-medium text-brand-700 hover:text-brand-600"
                              >
                                PDF
                              </a>
                              {inv.status === "DRAFT" && (
                                <>
                                  <form
                                    action={issueDraftInvoice}
                                    className="flex flex-wrap items-center gap-2"
                                  >
                                    <input type="hidden" name="id" value={inv.id} />
                                    <label className="flex items-center gap-1.5 text-xs text-stone-600">
                                      <input
                                        type="checkbox"
                                        name="dueAtClosing"
                                        value="1"
                                        defaultChecked={Boolean(txn.closeDate)}
                                        className="accent-brand-600"
                                      />
                                      due at closing
                                    </label>
                                    <input
                                      name="dueDate"
                                      type="date"
                                      className={`${input} px-2 py-1 text-xs`}
                                    />
                                    <button
                                      type="submit"
                                      className={`${btnGhost} px-2 py-1 text-xs`}
                                    >
                                      Issue invoice
                                    </button>
                                  </form>
                                  <form action={deleteDraftInvoice}>
                                    <input type="hidden" name="id" value={inv.id} />
                                    <button
                                      type="submit"
                                      className="text-xs text-stone-400 hover:text-red-600"
                                    >
                                      discard draft
                                    </button>
                                  </form>
                                </>
                              )}
                              {inv.status === "SENT" && inv.provider === "freehold" && (
                                <form
                                  action={markInvoicePaid}
                                  className="flex items-center gap-1.5"
                                >
                                  <input type="hidden" name="id" value={inv.id} />
                                  <input
                                    name="paidNote"
                                    placeholder="check #1042"
                                    className={`${input} w-28 px-2 py-1 text-xs`}
                                  />
                                  <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                                    Mark paid
                                  </button>
                                </form>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-2 text-xs text-stone-400">
                  Full invoice management — payments, partials, credit —{" "}
                  <Link href="/dashboard/invoices" className="text-brand-700 hover:underline">
                    on the Invoices page →
                  </Link>
                </p>
              </section>

              {isAdmin && (
                <section className={card}>
                  <h2 className="mb-1 font-medium">Add a charge</h2>
                  <p className="mb-3 text-sm text-stone-500">
                    Lands on this file's draft invoice (one is created if none is open) — review and
                    issue when ready. Extra work, deposits, adjustments.
                  </p>
                  {remainingToDraftCents != null && remainingToDraftCents > 0 && (
                    <form action={addTransactionCharge} className="mb-3">
                      <input type="hidden" name="transactionId" value={txn.id} />
                      <input type="hidden" name="kind" value="service" />
                      <input
                        type="hidden"
                        name="description"
                        value={`Transaction coordination: ${txn.propertyAddress}`}
                      />
                      <input
                        type="hidden"
                        name="amount"
                        value={(remainingToDraftCents / 100).toFixed(2)}
                      />
                      <button type="submit" className={btn}>
                        Draft the remaining fee — {fmtCents(remainingToDraftCents)}
                      </button>
                    </form>
                  )}
                  <form action={addTransactionCharge} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="transactionId" value={txn.id} />
                    <label className={label}>
                      Type
                      <select name="kind" defaultValue="upcharge" className={input}>
                        {LINE_KINDS.map(([k, lbl]) => (
                          <option key={k} value={k}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={`${label} min-w-56 flex-1`}>
                      Description
                      <input
                        name="description"
                        required
                        placeholder="Rush closing — additional coordination"
                        className={input}
                      />
                    </label>
                    <label className={label}>
                      Amount ($)
                      <input
                        name="amount"
                        inputMode="decimal"
                        required
                        placeholder="75.00"
                        className={`${input} w-28`}
                      />
                    </label>
                    <button type="submit" className={btnGhost}>
                      Add charge
                    </button>
                  </form>
                  <p className="mt-3 border-t border-stone-100 pt-2 text-xs text-stone-400">
                    Team payout for this file is set per person under{" "}
                    <Link
                      href={`/dashboard/transactions/${txn.id}?tab=participants`}
                      className="text-brand-700 hover:underline"
                    >
                      Participants
                    </Link>
                    ; per-file gross/net arrives with the payouts stage.
                  </p>
                </section>
              )}
            </div>
          )}
          {tab === "compliance" && (
            <section className={card}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 className="font-medium">Compliance</h2>
                {currentRound && (
                  <>
                    <Badge tone={COMPLIANCE_STATUS_TONE[currentRound.status]}>
                      {COMPLIANCE_STATUS_LABEL[currentRound.status]}
                    </Badge>
                    <span className="text-xs text-stone-400">
                      {currentRound.checklistName} · v{currentRound.version}
                      {currentRound.approvalLevels > 1 &&
                        ` · ${currentRound.approvalLevels}-level approval`}
                    </span>
                  </>
                )}
              </div>

              {!currentRound ? (
                <>
                  <p className="mb-3 text-sm text-stone-500">
                    {txn.client
                      ? txn.client.complianceEnabled
                        ? "Start a compliance round to pull in this client's required documents and send the file up for review."
                        : `Compliance is switched off for ${txn.client.name}. Turn it on from their profile to require documents on their files.`
                      : "Attach a client to this transaction to use their compliance checklist."}
                  </p>
                  {txn.client?.complianceEnabled && (
                    <form action={startRound}>
                      <input type="hidden" name="transactionId" value={txn.id} />
                      <button type="submit" className={btn}>
                        Start compliance round
                      </button>
                    </form>
                  )}
                </>
              ) : (
                <>
                  <p className="mb-4 text-sm text-stone-500">
                    Attach a file to each required document, then submit the whole file for review.
                    A reviewer approves each one or sends it back with a note.
                  </p>
                  <ul className="mb-4 flex flex-col">
                    {currentRound.slots.map((slot) => (
                      <li key={slot.id} className="border-b border-stone-100 py-2 last:border-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-medium">{slot.name}</span>
                          {slot.required ? (
                            <Badge tone="danger">required</Badge>
                          ) : (
                            <Badge tone="neutral">optional</Badge>
                          )}
                          <Badge
                            tone={
                              slot.status === "APPROVED"
                                ? "success"
                                : slot.status === "RETURNED"
                                  ? "danger"
                                  : slot.status === "SUBMITTED"
                                    ? "progress"
                                    : "neutral"
                            }
                          >
                            {COMPLIANCE_SLOT_LABEL[slot.status]}
                          </Badge>
                          {slot.status === "SUBMITTED" && slot.approvedTier > 0 && (
                            <span className="text-xs font-medium text-emerald-700">
                              level {slot.approvedTier}/{currentRound.approvalLevels} signed off —
                              awaiting level {slot.approvedTier + 1}
                            </span>
                          )}
                          {slot.description && (
                            <span className="text-xs text-stone-400">{slot.description}</span>
                          )}
                        </div>

                        {slot.reviewNote && (
                          <p className="mt-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                            Returned: {slot.reviewNote}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <form
                            action={attachSlotDocument}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input type="hidden" name="slotId" value={slot.id} />
                            <input type="hidden" name="transactionId" value={txn.id} />
                            <select
                              name="documentId"
                              defaultValue={slot.documentId ?? ""}
                              className={input}
                            >
                              <option value="">— no file attached —</option>
                              {currentDocs.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.filename}
                                </option>
                              ))}
                            </select>
                            <button type="submit" className={btnGhost}>
                              Save
                            </button>
                          </form>
                          {slot.document && (
                            <a
                              href={`/api/documents/${slot.document.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-brand-600 hover:underline"
                            >
                              open {slot.document.filename}
                            </a>
                          )}
                        </div>

                        {canReview &&
                          slot.status === "SUBMITTED" &&
                          reviewerTier > slot.approvedTier && (
                            <form
                              action={reviewSlot}
                              className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-stone-50 p-3"
                            >
                              <input type="hidden" name="slotId" value={slot.id} />
                              <input type="hidden" name="transactionId" value={txn.id} />
                              {currentRound.approvalLevels > 1 && (
                                <span className="w-full text-xs text-stone-500">
                                  Reviewing at level{" "}
                                  {Math.min(reviewerTier, currentRound.approvalLevels)} of{" "}
                                  {currentRound.approvalLevels}
                                </span>
                              )}
                              <label className={`${label} min-w-56 flex-1`}>
                                Note (required when sending back)
                                <input
                                  name="reviewNote"
                                  className={input}
                                  placeholder="Page 4 is missing an initial"
                                />
                              </label>
                              <button
                                type="submit"
                                name="decision"
                                value="approve"
                                className={btnGhost}
                              >
                                Approve
                              </button>
                              <button
                                type="submit"
                                name="decision"
                                value="return"
                                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                              >
                                Return
                              </button>
                            </form>
                          )}
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap items-center gap-3">
                    {currentRound.status !== "APPROVED" && (
                      <form action={submitForReview}>
                        <input type="hidden" name="complianceId" value={currentRound.id} />
                        <input type="hidden" name="transactionId" value={txn.id} />
                        <button type="submit" className={btn}>
                          Submit for review
                        </button>
                      </form>
                    )}
                    <form action={startRound}>
                      <input type="hidden" name="transactionId" value={txn.id} />
                      <button type="submit" className={btnGhost}>
                        Start a new version
                      </button>
                    </form>
                    {currentRound.submittedAt && (
                      <span className="text-xs text-stone-400">
                        Submitted {fmtDate(currentRound.submittedAt)}
                      </span>
                    )}
                  </div>

                  {priorRounds.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer select-none text-xs text-stone-500 hover:text-stone-700">
                        {priorRounds.length} earlier version{priorRounds.length === 1 ? "" : "s"}
                      </summary>
                      <ul className="mt-1.5 flex flex-col gap-1 border-l-2 border-stone-200 pl-3">
                        {priorRounds.map((r) => (
                          <li key={r.id} className="text-xs text-stone-500">
                            v{r.version} · {r.checklistName} · {COMPLIANCE_STATUS_LABEL[r.status]} ·{" "}
                            {r.slots.filter((s) => s.status === "APPROVED").length}/{r.slots.length}{" "}
                            approved
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </section>
          )}
          {tab === "dates" && (
            <>
              <section className={card}>
                <h2 className="mb-1 font-medium">Contract-governed dates</h2>
                <p className="mb-3 text-sm text-stone-500">
                  The contract is the source of truth. Changing the contract or closing date creates
                  an amendment to-do; the date only moves — and dependent task deadlines only
                  recompute — once you confirm the amendment is executed.
                </p>
                {(() => {
                  const proposed = (txn.proposedDates as Record<string, string> | null) ?? {};
                  const entries = Object.entries(proposed) as Array<
                    ["contractDate" | "closeDate", string]
                  >;
                  return entries.length > 0 ? (
                    <ul className="mb-4 flex flex-col gap-2">
                      {entries.map(([field, value]) => (
                        <li
                          key={field}
                          className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm"
                        >
                          <span className="font-medium text-amber-900">
                            {field === "closeDate" ? "Closing date" : "Contract date"}:{" "}
                            {fmtDate(field === "closeDate" ? txn.closeDate : txn.contractDate)} →{" "}
                            {value}
                          </span>
                          <span className="text-xs text-amber-700">
                            awaiting executed amendment
                          </span>
                          <span className="ml-auto flex items-center gap-2">
                            <form action={confirmDateChange}>
                              <input type="hidden" name="id" value={txn.id} />
                              <input type="hidden" name="field" value={field} />
                              <button
                                type="submit"
                                className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-brand-700"
                              >
                                Amendment executed — apply
                              </button>
                            </form>
                            <form action={withdrawDateChange}>
                              <input type="hidden" name="id" value={txn.id} />
                              <input type="hidden" name="field" value={field} />
                              <button
                                type="submit"
                                className="text-xs text-stone-500 hover:text-red-700"
                              >
                                Withdraw
                              </button>
                            </form>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null;
                })()}
                <form action={proposeDateChange} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={txn.id} />
                  <label className={label}>
                    Propose a change to
                    <select name="field" className={input} defaultValue="closeDate">
                      <option value="closeDate">Closing date</option>
                      <option value="contractDate">Contract date</option>
                    </select>
                  </label>
                  <label className={label}>
                    New date
                    <input type="date" name="proposedDate" required className={input} />
                  </label>
                  <button type="submit" className={btnGhost}>
                    Propose &amp; create amendment to-do
                  </button>
                </form>
              </section>
              <section className={card}>
                <h2 className="mb-3 font-medium">Details</h2>
                <form
                  action={updateTransaction}
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                >
                  <input type="hidden" name="id" value={txn.id} />
                  <label className={`${label} lg:col-span-2`}>
                    Property address
                    <input
                      name="propertyAddress"
                      defaultValue={txn.propertyAddress}
                      className={input}
                    />
                  </label>
                  <label className={label}>
                    Client
                    <select name="clientId" defaultValue={txn.clientId ?? ""} className={input}>
                      <option value="">—</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    Status
                    <select name="status" defaultValue={txn.status} className={input}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    City
                    <input name="city" defaultValue={txn.city ?? ""} className={input} />
                  </label>
                  <label className={label}>
                    State
                    <input
                      name="state"
                      defaultValue={txn.state ?? ""}
                      maxLength={2}
                      className={input}
                    />
                  </label>
                  <label className={label}>
                    ZIP
                    <input name="zip" defaultValue={txn.zip ?? ""} className={input} />
                  </label>
                  <label className={label}>
                    Side
                    <select name="side" defaultValue={txn.side} className={input}>
                      {SIDES.map((s) => (
                        <option key={s} value={s}>
                          {sideLabel(s, labels)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    Purchase price ($)
                    <input
                      name="purchasePrice"
                      inputMode="numeric"
                      defaultValue={txn.purchasePrice ?? ""}
                      className={input}
                    />
                  </label>
                  <label className={label}>
                    Expected fee ($)
                    <input
                      name="expectedFee"
                      inputMode="decimal"
                      defaultValue={
                        txn.expectedFeeCents == null ? "" : (txn.expectedFeeCents / 100).toFixed(2)
                      }
                      placeholder="350.00"
                      className={input}
                    />
                    <span className="text-xs font-normal text-stone-400">
                      What you'll bill for this file. Blank = client default · 0 = no charge.
                    </span>
                  </label>
                  <label className={label}>
                    Contract date
                    <input
                      name="contractDate"
                      type="date"
                      defaultValue={txn.contractDate ? fmtDate(txn.contractDate) : ""}
                      className={input}
                    />
                  </label>
                  <label className={label}>
                    Close date
                    <input
                      name="closeDate"
                      type="date"
                      defaultValue={txn.closeDate ? fmtDate(txn.closeDate) : ""}
                      className={input}
                    />
                  </label>
                  <label className={label}>
                    Mortgage commitment
                    <input
                      name="mortgageCommitmentDate"
                      type="date"
                      defaultValue={
                        txn.mortgageCommitmentDate ? fmtDate(txn.mortgageCommitmentDate) : ""
                      }
                      className={input}
                    />
                  </label>
                  <label className={label}>
                    Inspection deadline
                    <input
                      name="inspectionDeadlineDate"
                      type="date"
                      defaultValue={
                        txn.inspectionDeadlineDate ? fmtDate(txn.inspectionDeadlineDate) : ""
                      }
                      className={input}
                    />
                  </label>
                  <label className={`${label} lg:col-span-3`}>
                    Notes
                    <input name="notes" defaultValue={txn.notes ?? ""} className={input} />
                  </label>
                  <div className="flex items-end">
                    <button type="submit" className={btn}>
                      Save changes
                    </button>
                  </div>
                </form>
              </section>
            </>
          )}
          {tab === "participants" && (
            <>
              <section className={card}>
                <h2 className="mb-1 font-medium">Assigned</h2>
                <p className="mb-3 text-sm text-stone-500">
                  Who in the workspace works this file. Filter the transactions list to "Assigned to
                  me" to see your own.
                  {canSetFees && " Set what each person is paid; they request it when it's due."}
                </p>
                {txn.assignees.length === 0 ? (
                  <p className="mb-3 text-sm text-stone-400">Nobody assigned yet.</p>
                ) : (
                  <ul className="mb-4 flex flex-col gap-1">
                    {txn.assignees.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 text-sm">
                        <Avatar user={a.user} size={28} />
                        <span className="font-medium">{a.user.name}</span>
                        {a.roleLabel && <span className="text-stone-500">{a.roleLabel}</span>}
                        {canSetFees && !a.paymentItem && (
                          <form action={setAssigneeFee} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="transactionId" value={txn.id} />
                            <span className="text-xs text-stone-400">fee $</span>
                            <input
                              name="feeCents"
                              defaultValue={a.feeCents == null ? "" : (a.feeCents / 100).toFixed(2)}
                              placeholder="350.00"
                              className={`${input} w-24 px-2 py-1 text-xs`}
                            />
                            <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                              Save
                            </button>
                          </form>
                        )}
                        {a.paymentItem && (
                          <span className="text-xs text-stone-500">
                            {fmtCents(a.paymentItem.feeCents)} ·{" "}
                            {a.paymentItem.request.status === "PAID" ? "paid" : "payment requested"}
                          </span>
                        )}
                        {!canSetFees && !a.paymentItem && a.feeCents != null && (
                          <span className="text-xs text-stone-500">{fmtCents(a.feeCents)}</span>
                        )}
                        <form action={unassignUser} className="ml-auto">
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="transactionId" value={txn.id} />
                          <button
                            type="submit"
                            className="text-xs text-stone-400 hover:text-red-600"
                          >
                            remove
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={assignUser} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="transactionId" value={txn.id} />
                  <label className={label}>
                    Member
                    <select name="userId" className={input} defaultValue="" required>
                      <option value="" disabled>
                        Choose…
                      </option>
                      {workspaceMembers.map((m) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    Role on this file
                    <input name="roleLabel" className={input} placeholder="Lead TC" />
                  </label>
                  <button type="submit" className={btnGhost}>
                    Assign
                  </button>
                </form>
              </section>

              <section className={card}>
                <h2 className="mb-3 font-medium">Parties</h2>
                {txn.parties.length === 0 ? (
                  <p className="mb-3 text-sm text-stone-500">No parties attached yet.</p>
                ) : (
                  <ul className="mb-4 flex flex-col gap-1">
                    {txn.parties.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 text-sm">
                        <span className="w-36 shrink-0 text-stone-500">{ROLE_LABEL[p.role]}</span>
                        <span className="font-medium">{p.contact.name}</span>
                        <span className="text-stone-500">
                          {p.contact.email ?? p.contact.phone ?? ""}
                        </span>
                        <form action={removeParty} className="ml-auto">
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="transactionId" value={txn.id} />
                          <button
                            type="submit"
                            className="text-xs text-stone-400 hover:text-red-600"
                          >
                            remove
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={addParty} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="transactionId" value={txn.id} />
                  <label className={label}>
                    Contact
                    <select name="contactId" className={input} defaultValue="">
                      <option value="" disabled>
                        Choose…
                      </option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    Role
                    <select name="role" className={input} defaultValue="BUYER">
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className={btnGhost}>
                    Add party
                  </button>
                </form>
                {contacts.length === 0 && (
                  <p className="mt-2 text-xs text-stone-400">
                    No contacts yet —{" "}
                    <Link href="/dashboard/contacts" className="text-brand-600 hover:underline">
                      add some first
                    </Link>
                    .
                  </p>
                )}
              </section>
            </>
          )}
          {tab === "emails" && (
            <>
              <section className={card}>
                <h2 className="mb-1 font-medium">Send an email</h2>
                {!emailEnabled() ? (
                  <p className="text-sm text-stone-500">
                    Email isn't configured on this install — set{" "}
                    <code className="font-mono text-xs">RESEND_API_KEY</code>,{" "}
                    <code className="font-mono text-xs">EMAIL_FROM_DOMAIN</code>, and{" "}
                    <code className="font-mono text-xs">EMAIL_REPLY_DOMAIN</code>. Replies come
                    straight back onto this transaction.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-stone-500">
                      Sends from your workspace's address; replies land right back on this
                      transaction.
                      {ccEmail && (
                        <>
                          {" "}
                          Auto-CC'd to <span className="font-medium text-stone-600">{ccEmail}</span>
                          .
                        </>
                      )}
                    </p>
                    {emailTemplates.length > 0 && (
                      <div className="mb-3 flex flex-col gap-1.5 text-xs">
                        {emailTaskTitle && suggestedTemplates.length > 0 && (
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="font-medium uppercase tracking-wide text-brand-700">
                              Suggested for “{emailTaskTitle.slice(0, 40)}”
                            </span>
                            {suggestedTemplates.map((t) => (
                              <Link
                                key={t.id}
                                href={`/dashboard/transactions/${txn.id}?tab=emails&emailTemplate=${t.id}${emailTask ? `&emailTask=${emailTask}` : ""}`}
                                className={`rounded-full border px-2.5 py-1 transition-colors ${
                                  t.id === emailTemplate
                                    ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                                    : "border-brand-300 bg-brand-50/50 text-brand-800 hover:border-brand-600"
                                }`}
                              >
                                {t.name.replace(" (Sample)", "")}
                              </Link>
                            ))}
                          </p>
                        )}
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-medium uppercase tracking-wide text-stone-400">
                            {emailTaskTitle && suggestedTemplates.length > 0
                              ? "All templates"
                              : "Start from a template"}
                          </span>
                          {restTemplates.map((t) => (
                            <Link
                              key={t.id}
                              href={`/dashboard/transactions/${txn.id}?tab=emails&emailTemplate=${t.id}${emailTask ? `&emailTask=${emailTask}` : ""}`}
                              className={`rounded-full border px-2.5 py-1 transition-colors ${
                                t.id === emailTemplate
                                  ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                                  : "border-stone-200 text-stone-600 hover:border-brand-600 hover:text-brand-700"
                              }`}
                            >
                              {t.name.replace(" (Sample)", "")}
                            </Link>
                          ))}
                        </p>
                      </div>
                    )}
                    <form
                      action={sendTransactionEmail}
                      className="flex flex-col gap-3"
                      key={emailTemplate ?? "blank"}
                    >
                      <input type="hidden" name="transactionId" value={txn.id} />
                      {selectedEmailTemplate && (
                        <input
                          type="hidden"
                          name="emailTemplateId"
                          value={selectedEmailTemplate.id}
                        />
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={label}>
                          To
                          <input
                            name="to"
                            required
                            list={`party-emails-${txn.id}`}
                            placeholder="name@example.com"
                            className={input}
                          />
                        </label>
                        <datalist id={`party-emails-${txn.id}`}>
                          {txn.parties
                            .filter((p) => p.contact.email)
                            .map((p) => (
                              <option key={p.id} value={p.contact.email ?? ""}>
                                {p.contact.name}
                              </option>
                            ))}
                        </datalist>
                        <label className={label}>
                          Subject
                          <input
                            name="subject"
                            required
                            defaultValue={composeSubject}
                            className={input}
                          />
                        </label>
                      </div>
                      <label className={label}>
                        Message
                        <textarea
                          id="compose-body"
                          name="body"
                          required
                          rows={9}
                          defaultValue={composeBody}
                          className={input}
                        />
                      </label>
                      {currentDocs.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-stone-700">
                            Attach documents
                          </span>
                          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                            {currentDocs.map((d) => (
                              <label
                                key={d.id}
                                className="flex items-center gap-1.5 text-sm text-stone-600"
                              >
                                <input
                                  type="checkbox"
                                  name="attachDoc"
                                  value={d.id}
                                  defaultChecked={attachPrechecked.has(d.id)}
                                  className="accent-brand-600"
                                />
                                {d.filename}
                                <span className="text-xs text-stone-400">
                                  ({(d.sizeBytes / 1024).toFixed(0)} KB)
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-stone-400">
                        Formatting: **bold**, _italic_, "# " big heading, "- " bullet lists — the
                        sent email renders them properly. Merge codes work in templates:{" "}
                        {EMAIL_MERGE_CODES.slice(0, 4).join(" ")} …
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <button type="submit" className={btn}>
                          Send email
                        </button>
                        <LiveDictateButton targetId="compose-body" transactionId={txn.id} />
                        <label className="ml-auto flex items-center gap-2 text-xs text-stone-500">
                          Send later
                          <input
                            type="datetime-local"
                            name="sendAt"
                            className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs focus:border-brand-600 focus:outline-none"
                          />
                        </label>
                      </div>
                    </form>
                  </>
                )}
              </section>

              {scheduledEmails.length > 0 && (
                <section className={card}>
                  <h2 className="mb-1 font-medium">Scheduled</h2>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {scheduledEmails.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-3">
                        <span className="font-medium">{e.subject}</span>
                        <span className="text-stone-500">to {e.toAddr}</span>
                        <span className="tabular-nums text-xs text-stone-400">
                          {e.sendAt.toLocaleString()}
                        </span>
                        <form action={cancelScheduledEmail} className="ml-auto">
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="transactionId" value={txn.id} />
                          <button
                            type="submit"
                            className="text-xs text-stone-400 hover:text-red-600"
                          >
                            Cancel
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className={card}>
                <h2 className="mb-3 font-medium">Thread</h2>
                {txn.emails.length === 0 ? (
                  <p className="text-sm text-stone-500">No email on this transaction yet.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {txn.emails.map((e) => (
                      <li
                        key={e.id}
                        className={`rounded-xl border p-3.5 text-sm ${
                          e.direction === "INBOUND"
                            ? "border-brand-600/20 bg-brand-50/50"
                            : "border-stone-200/70 bg-white"
                        }`}
                      >
                        <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="font-medium">
                            {e.direction === "INBOUND" ? "↩ Reply" : "→ Sent"}
                          </span>
                          <span className="text-stone-500">
                            {e.direction === "INBOUND" ? `from ${e.fromAddr}` : `to ${e.toAddr}`}
                          </span>
                          <span className="ml-auto flex items-center gap-2">
                            {e.status !== "SENT" && e.status !== "RECEIVED" && (
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                  e.status === "DELIVERED"
                                    ? "bg-brand-50 text-brand-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {e.status.toLowerCase()}
                              </span>
                            )}
                            <span className="font-mono text-xs tabular-nums text-stone-400">
                              {fmtDate(e.createdAt)}
                            </span>
                          </span>
                        </div>
                        <p className="font-medium">{e.subject}</p>
                        <p className="mt-1 max-w-prose whitespace-pre-wrap leading-relaxed text-stone-600">
                          {e.bodyText.length > 800 ? `${e.bodyText.slice(0, 800)}…` : e.bodyText}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
          {tab === "notes" && (
            <section className={card}>
              <h2 className="mb-1 font-medium">Notes</h2>
              {txn.notes ? (
                <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed">
                  {txn.notes}
                </p>
              ) : (
                <p className="text-sm text-stone-500">No notes yet.</p>
              )}
              <p className="mt-3 text-xs text-stone-400">
                Edit notes in the{" "}
                <Link href={`/dashboard/transactions/${txn.id}?tab=dates`} className="underline">
                  Dates &amp; details
                </Link>{" "}
                tab.
              </p>
            </section>
          )}
          {tab === "payout" && canSetFees && (
            <section className={card}>
              <h2 className="mb-1 font-medium">Invoices</h2>
              <p className="mb-3 text-sm text-stone-500">
                Bill the client for this file — they pay however they pay (check, Zelle, wire,
                closing proceeds). A follow-up task stays open until you mark it paid.
              </p>
              {txn.invoices.length > 0 && (
                <ul className="mb-4 flex flex-col">
                  {txn.invoices.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex flex-wrap items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                    >
                      <span className="font-medium">{invoiceLabel(inv.number)}</span>
                      <span className="tabular-nums">{fmtCents(inv.amountCents)}</span>
                      {inv.paymentTerms && (
                        <span className="text-xs text-stone-400">{inv.paymentTerms}</span>
                      )}
                      <Badge
                        tone={
                          inv.status === "PAID"
                            ? "success"
                            : inv.status === "VOID"
                              ? "neutral"
                              : "progress"
                        }
                      >
                        {inv.status === "SENT"
                          ? "Outstanding"
                          : inv.status === "PAID"
                            ? "Paid"
                            : "Void"}
                      </Badge>
                      <a
                        href={`/api/invoices/${inv.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-600 hover:underline"
                      >
                        PDF
                      </a>
                      <Link
                        href="/dashboard/invoices"
                        className="ml-auto text-xs text-stone-400 hover:underline"
                      >
                        manage →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {txn.client ? (
                <form action={createInvoice} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="clientId" value={txn.client.id} />
                  <input type="hidden" name="transactionId" value={txn.id} />
                  <label className={label}>
                    Amount (USD) *
                    <input
                      name="amount"
                      inputMode="decimal"
                      required
                      placeholder="350.00"
                      className={`${input} w-28`}
                    />
                  </label>
                  <label className={`${label} min-w-56 flex-1`}>
                    Description
                    <input
                      name="description"
                      defaultValue={`Transaction coordination: ${txn.propertyAddress}`}
                      className={input}
                    />
                  </label>
                  <label className={label}>
                    Payment terms
                    <input
                      name="paymentTerms"
                      list="txn-term-presets"
                      placeholder="Due at closing"
                      className={input}
                    />
                    <datalist id="txn-term-presets">
                      {TERM_PRESETS.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </label>
                  <label className={label}>
                    Due
                    <input name="dueDate" type="date" className={input} />
                  </label>
                  <button type="submit" className={btnGhost}>
                    Issue invoice to {txn.client.name}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-stone-400">
                  Attach a client to this transaction to invoice them.
                </p>
              )}
            </section>
          )}
          {tab === "payout" && (
            <section className={card}>
              <h2 className="mb-1 font-medium">Payout</h2>
              <p className="mb-3 text-sm text-stone-500">
                Commission percentages against the contract price
                {txn.purchasePrice ? ` (${fmtMoney(txn.purchasePrice)})` : ""}.
              </p>
              {(() => {
                const payout =
                  (txn.payout as { listPct?: number; buyPct?: number; note?: string } | null) ?? {};
                const price = txn.purchasePrice ?? 0;
                const gross = (pct?: number | null) =>
                  pct && price ? fmtMoney(Math.round((price * pct) / 100)) : "—";
                return (
                  <form action={updatePayout} className="flex flex-col gap-3">
                    <input type="hidden" name="id" value={txn.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className={label}>
                        {labels.sell} %
                        <input
                          name="listPct"
                          defaultValue={payout.listPct ?? ""}
                          inputMode="decimal"
                          className={input}
                        />
                      </label>
                      <label className={label}>
                        {labels.buy} %
                        <input
                          name="buyPct"
                          defaultValue={payout.buyPct ?? ""}
                          inputMode="decimal"
                          className={input}
                        />
                      </label>
                    </div>
                    <p className="text-sm text-stone-600">
                      Estimated gross — list: <strong>{gross(payout.listPct)}</strong> · buy:{" "}
                      <strong>{gross(payout.buyPct)}</strong>
                    </p>
                    <label className={label}>
                      Notes
                      <input name="payoutNote" defaultValue={payout.note ?? ""} className={input} />
                    </label>
                    <div>
                      <button type="submit" className={btn}>
                        Save payout
                      </button>
                    </div>
                  </form>
                );
              })()}
            </section>
          )}
          {tab === "misc" && (
            <>
              {txn.intakeSubmissions.length > 0 && (
                <section className={card}>
                  <h2 className="mb-1 font-medium">Intake submissions</h2>
                  <p className="mb-3 text-sm text-stone-500">
                    Submitted by your clients through the portal. Uploaded files are on the
                    Documents tab, prefixed “Intake —”.
                  </p>
                  <ul className="flex flex-col gap-4">
                    {txn.intakeSubmissions.map((sub) => {
                      const answers = (sub.data ?? {}) as Record<string, string>;
                      return (
                        <li key={sub.id} className="rounded-lg border border-stone-200/70 p-3">
                          <p className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
                              {sideLabel(sub.side, labels)}
                            </span>
                            <span className="font-medium">{answers.legalNames ?? "Client"}</span>
                            <span className="text-xs text-stone-400">
                              {fmtDate(sub.createdAt)}
                              {sub.documentIds.length > 0 &&
                                ` · ${sub.documentIds.length} file${sub.documentIds.length === 1 ? "" : "s"}`}
                            </span>
                          </p>
                          <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                            {Object.entries(answers).map(([k, v]) => (
                              <div key={k} className="flex flex-col">
                                <dt className="text-xs uppercase tracking-wide text-stone-400">
                                  {k.replace(/([A-Z])/g, " $1")}
                                </dt>
                                <dd className="whitespace-pre-wrap">{v}</dd>
                              </div>
                            ))}
                          </dl>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              <section className={card}>
                <h2 className="mb-1 font-medium">Client portal links</h2>
                <p className="mb-3 text-sm text-stone-500">
                  Share a read-only view of this transaction — text or email the link to your buyer,
                  seller, or agent. You choose what each link shows; revoke any time.
                </p>
                {txn.portalLinks.length > 0 && (
                  <ul className="mb-4 flex flex-col">
                    {txn.portalLinks.map((pl) => {
                      const url = `${portalBase}/portal/${pl.token}`;
                      return (
                        <li key={pl.id} className="border-b border-stone-100 py-2 last:border-0">
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="font-medium">{pl.label}</span>
                            <span className="text-xs text-stone-400">
                              shows:{" "}
                              {[
                                pl.showTasks && "tasks",
                                pl.showParties && "parties",
                                pl.showDocuments && "documents",
                              ]
                                .filter(Boolean)
                                .join(", ") || "summary only"}
                            </span>
                            {pl.revokedAt ? (
                              <Badge tone="neutral">revoked</Badge>
                            ) : (
                              <span className="text-xs text-stone-400">
                                {pl.lastAccessedAt
                                  ? `last viewed ${fmtDate(pl.lastAccessedAt)}`
                                  : "never viewed"}
                              </span>
                            )}
                            <span className="ml-auto flex items-center gap-3">
                              <form action={setPortalLinkActive}>
                                <input type="hidden" name="id" value={pl.id} />
                                <input
                                  type="hidden"
                                  name="active"
                                  value={pl.revokedAt ? "1" : "0"}
                                />
                                <button
                                  type="submit"
                                  className="text-xs font-medium text-stone-500 hover:text-brand-700"
                                >
                                  {pl.revokedAt ? "Activate" : "Deactivate"}
                                </button>
                              </form>
                              <DangerDelete
                                compact
                                action={deletePortalLink}
                                label="Delete"
                                description="Permanently removes this portal link."
                                hidden={{ id: pl.id, transactionId: txn.id }}
                              />
                            </span>
                          </div>
                          {!pl.revokedAt && (
                            <input
                              readOnly
                              value={url}
                              className="mt-1 w-full rounded border border-stone-200 bg-stone-50 px-2 py-1 font-mono text-xs text-stone-600"
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <form action={createPortalLink} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="transactionId" value={txn.id} />
                  <label className={label}>
                    Label *
                    <input name="label" required placeholder="Buyer — Jordan" className={input} />
                  </label>
                  <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      name="showTasks"
                      defaultChecked
                      className="h-4 w-4 accent-brand-600"
                    />
                    Tasks
                  </label>
                  <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      name="showParties"
                      defaultChecked
                      className="h-4 w-4 accent-brand-600"
                    />
                    Parties
                  </label>
                  <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      name="showDocuments"
                      className="h-4 w-4 accent-brand-600"
                    />
                    Documents
                  </label>
                  <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      name="showIntake"
                      defaultChecked
                      className="h-4 w-4 accent-brand-600"
                    />
                    Intake forms
                  </label>
                  <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      name="showVendorOrders"
                      className="h-4 w-4 accent-brand-600"
                    />
                    Order services
                  </label>
                  <button type="submit" className={btnGhost}>
                    Create link
                  </button>
                </form>
              </section>
            </>
          )}
        </div>
      </div>

      {isAdmin && (
        <DangerDelete
          action={deleteTransaction}
          label="Delete this transaction"
          description={`Removes ${txn.propertyAddress} with its tasks, documents, parties, and portal links. This cannot be undone.`}
          hidden={{ id: txn.id }}
        />
      )}
    </div>
  );
}
