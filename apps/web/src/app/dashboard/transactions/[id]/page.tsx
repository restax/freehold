import { PartyRole, prisma, TransactionSide, withTenant } from "@freehold/db";
import {
  Archive,
  ArrowSquareOut,
  CalendarBlank,
  CalendarCheck,
  ChartPieSlice,
  ChatCircle,
  CheckSquare,
  Clock,
  CurrencyDollar,
  DotsThree,
  Envelope,
  FilePdf,
  FolderSimple,
  Link as LinkIcon,
  ListBullets,
  NotePencil,
  PaperPlaneTilt,
  PenNib,
  Plus,
  PlusCircle,
  Receipt,
  ShieldCheck,
  Sparkle,
  Tag,
  Textbox,
  Tray,
  UserCircle,
  UsersThree,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { ActivityPanel } from "@/components/activity-panel";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { AgentsCommissions } from "@/components/agents-commissions";
import { Avatar } from "@/components/avatar";
import { Badge, EnvelopeBadge, ExtractionBadge } from "@/components/badges";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BulkSelectSummary } from "@/components/bulk-select-summary";
import { CcEmailPill } from "@/components/cc-email-pill";
import {
  ClosingDateCalendar,
  type DateMarker,
  type MarkerKind,
} from "@/components/closing-date-calendar";
import { ColumnPicker } from "@/components/column-picker";
import { ComplianceProgressCard } from "@/components/compliance-progress";
import { DangerDelete } from "@/components/danger-delete";
import { DocumentDropZone } from "@/components/document-drop-zone";
import { EmailPortalLinkForm } from "@/components/email-portal-link-form";
import { EmailTemplateSelect } from "@/components/email-template-select";
import { EmptyState } from "@/components/empty-state";
import { EntityPicker } from "@/components/entity-picker";
import { ExtractButton } from "@/components/extract-button";
import { HandbookNotes } from "@/components/handbook-notes";
import { HandbookRecap, type RecapGrade } from "@/components/handbook-recap";
import { InvoiceStatusTracker } from "@/components/invoice-status-tracker";
import { KeyDateRow } from "@/components/key-date-row";
import { LinkPartyForm } from "@/components/link-party-form";
import { ListingDetailRow } from "@/components/listing-detail-row";
import { PanelJump } from "@/components/panel-jump";
import { ParticipantEditor } from "@/components/participant-editor";
import { PendingButton } from "@/components/pending-button";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { SectionCard } from "@/components/section-card";
import { SideBadge } from "@/components/side-badge";
import { SideFields } from "@/components/side-fields";
import { SplitPdfDialog } from "@/components/split-pdf-dialog";
import { StatusSelect } from "@/components/status-select";
import { TaskTable } from "@/components/task-table";
import { TemplateEditor } from "@/components/template-editor";
import { TimeTrackingPing } from "@/components/time-tracking-ping";
import { UploadOnChange } from "@/components/upload-on-change";
import { VendorOrderTab } from "@/components/vendor-order-tab";
import { VisibilityToggles } from "@/components/visibility-toggles";
import { assignUser, unassignUser } from "@/lib/actions/assignees";
import { applyAttachmentTemplate } from "@/lib/actions/attachment-templates";
import {
  addAttachmentNote,
  addAttachmentRow,
  addAttachmentWebLinks,
  bulkDeleteAttachments,
  bulkEmailAttachments,
  bulkIncludeAttachments,
  bulkMoveAttachments,
  bulkOmitAttachments,
  bulkZipAttachments,
  createAttachmentFolder,
  deleteAttachmentFolder,
  deleteAttachmentNote,
  executeAttachmentSignatures,
  linkAttachmentDocument,
  removeAttachmentRow,
  renameAttachmentFolder,
  renameAttachmentRow,
  setAttachmentFolder,
  setAttachmentOmitted,
  setAttachmentSignatureTracking,
  setAttachmentWebUrl,
  toggleAttachmentComplete,
  toggleAttachmentPortalVisible,
  toggleAttachmentSigner,
} from "@/lib/actions/attachments";
import {
  attachSlotDocument,
  reviewSlot,
  startRound,
  submitForReview,
} from "@/lib/actions/compliance";
import { createContactByName, updateParticipantContact } from "@/lib/actions/contacts";
import { enableProFeatures } from "@/lib/actions/credits";
import { applyDateTemplateValues, previewDateTemplate } from "@/lib/actions/date-templates";
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
import { addParty, linkExtractedParty, removeParty } from "@/lib/actions/parties";
import { setAssigneeFee } from "@/lib/actions/pay";
import { combineDocuments, splitDocument } from "@/lib/actions/pdf-tools";
import {
  createPortalLink,
  deletePortalLink,
  emailPortalLink,
  setPortalLinkActive,
} from "@/lib/actions/portal";
import { saveTaskColumns } from "@/lib/actions/table-prefs";
import {
  applyActionPlan,
  createTask,
  deleteTask,
  setTaskDueDate,
  setTaskNotes,
  setTaskPriority,
  setTaskStatus,
  toggleTask,
} from "@/lib/actions/tasks";
import { generateDocument } from "@/lib/actions/templates";
import {
  confirmDateChange,
  deleteTransaction,
  proposeDateChange,
  removeCustomField,
  removeTransactionParty,
  setCustomField,
  updateKeyDate,
  updateListingDetail,
  updateTransaction,
  withdrawDateChange,
} from "@/lib/actions/transactions";
import { lastSentByDocument, lastSentByPortalLink, recentActivity } from "@/lib/activity";
import { isAgentEligible } from "@/lib/agent-contacts";
import {
  type ContractParty,
  type ExecutionCheck,
  executionNotice,
  partyLabel,
} from "@/lib/ai/contract-schema";
import { transactionAlert } from "@/lib/alerts";
import {
  attachmentState,
  filterAttachments,
  groupAttachments,
  linkLabel,
  progressOf,
} from "@/lib/attachments";
import { emailContextForTransaction, tcPhone } from "@/lib/auto-emails";
import {
  displayState,
  type InvoiceDisplayState,
  invoiceMoney,
  LINE_KINDS,
  paidCents,
  transactionBilling,
} from "@/lib/billing";
import { assigneePayout, filePayoutTotals, formatPercentBp } from "@/lib/billing-payouts";
import { transactionLayout } from "@/lib/client-types";
import {
  SLOT_LABEL as COMPLIANCE_SLOT_LABEL,
  STATUS_LABEL as COMPLIANCE_STATUS_LABEL,
  STATUS_TONE as COMPLIANCE_STATUS_TONE,
  complianceProgress,
  effectiveTier,
} from "@/lib/compliance";
import { readContactPoints } from "@/lib/contact-points";
import { emailEnabled } from "@/lib/email";
import { type EmailContact, parseEmailSettings, renderMerge } from "@/lib/email-template";
import { suggestForTask } from "@/lib/email-template-library";
import { fmtDate, fmtDayMonth, fmtMoney, ROLE_LABEL } from "@/lib/format";
import { isGovernedDateField, KEY_DATE_LABELS } from "@/lib/governed-dates";
import { poolForTransaction } from "@/lib/handbook";
import { invoiceLabel, TERM_PRESETS } from "@/lib/invoicing";
import { gapForTransaction, gapMessage } from "@/lib/licensing";
import { GROUP_LABEL, groupPartiesBySide } from "@/lib/party-side";
import { fmtCents } from "@/lib/pay";
import { creditBalance, handbookState, transactionHasPro } from "@/lib/plans";
import { portalOrigin } from "@/lib/portal";
import { sideLabel, tenantSideLabels } from "@/lib/side-labels";
import {
  ROLE_ABBR,
  readSignatureState,
  signatureProgress,
  signerParties,
} from "@/lib/signature-tracking";
import { PROSPECTING_TEMPLATE_GROUP } from "@/lib/starter-email-templates";
import { resolveTaskColumns, TASK_COLUMNS, taskColumnGroups } from "@/lib/task-columns";
import { buildTemplateMergeContext } from "@/lib/template-merge";
import {
  getBillingAccess,
  getMemberCompliance,
  getMemberRole,
  guestMaySeeTransaction,
  requireTenant,
} from "@/lib/tenant";
import {
  btn,
  btnAdd,
  btnGhost,
  card,
  composeLabel,
  composeRow,
  input,
  label,
  tableWrap,
  td,
  th,
  trHover,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

const SIDES = Object.values(TransactionSide);
const ROLES = Object.values(PartyRole);

/**
 * The tabs split into two rows by how often a coordinator reaches for them.
 *
 * The first row is the daily loop — the work of running a file — and is
 * mirrored, in this order, by the Transactions submenu in the sidebar
 * (see TXN_TAB_ITEMS in components/dashboard-nav.tsx). Keep the two in step:
 * they read as one control, and an order that disagrees is worse than no
 * submenu at all. The second row is the reference and set-up material you
 * visit when something specific needs changing.
 */
/** Ties the row checkboxes to the bulk bar's form without nesting them. */
const BULK_FORM_ID = "attachment-bulk";

const TXN_TABS_PRIMARY = [
  ["tasks", "Tasks"],
  ["documents", "Attachments"],
  ["emails", "Emails"],
  ["notes", "Notes"],
  ["dates", "Details"],
] as const;

const TXN_TABS_SECONDARY = [
  ["participants", "Participants"],
  ["vendors", "Vendors"],
  ["team", "Team"],
  ["compliance", "Compliance"],
  ["billing", "Billing"],
  ["payout", "Payout"],
  ["misc", "Portals & misc"],
] as const;

const TXN_TABS = [...TXN_TABS_PRIMARY, ...TXN_TABS_SECONDARY] as const;
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
    splitError?: string;
    dateTemplate?: string;
    emailTo?: string | string[];
    attachDoc?: string | string[];
    aq?: string;
    aHide?: string | string[];
  }>;
}) {
  const { tenantId, session } = await requireTenant({ allowGuest: true });
  const role = await getMemberRole(tenantId, session.user.id);
  const isAdmin = role === "owner" || role === "admin";
  // Money on the file is permissioned separately from working the file
  // (guests resolve to no access inside billingCapability).
  const billing = await getBillingAccess(tenantId, session.user.id);
  const labels = await tenantSideLabels(tenantId);
  const { id } = await params;
  // A guest reaches only the files they were handed; anything else doesn't
  // exist as far as they're concerned.
  if (!(await guestMaySeeTransaction(tenantId, session.user.id, id))) notFound();
  const {
    tab: tabRaw,
    emailTemplate,
    emailTask,
    licenseError,
    splitError,
    dateTemplate,
    emailTo,
    attachDoc,
    aq,
    aHide,
  } = await searchParams;
  const tab: TxnTab = (TXN_TABS.some(([t]) => t === tabRaw) ? tabRaw : "tasks") as TxnTab;
  // Attachments search and filters live in the URL so the tab stays a server
  // component and the state survives a mutation's revalidate — a client-side
  // filter would reset itself every time somebody ticked a row.
  const attachQuery = (aq ?? "").trim();
  const attachHide = new Set(Array.isArray(aHide) ? aHide : aHide ? [aHide] : []);
  const attachFilter = {
    q: attachQuery,
    hideComplete: attachHide.has("complete"),
    hideOmitted: attachHide.has("omitted"),
  };
  const attachFiltered = attachQuery !== "" || attachHide.size > 0;

  const data = await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUnique({
      where: { id },
      include: {
        client: true,
        invoices: { orderBy: { number: "desc" } },
        intakeSubmissions: { orderBy: { createdAt: "desc" } },
        parties: { include: { contact: true }, orderBy: { createdAt: "asc" } },
        attachments: {
          orderBy: { sortOrder: "asc" },
          include: {
            document: {
              select: {
                id: true,
                filename: true,
                contentType: true,
                sizeBytes: true,
                createdAt: true,
                uploadedByName: true,
                visibleToAgent: true,
                visibleToClient: true,
                _count: { select: { extractions: true } },
              },
            },
            notes: { orderBy: { createdAt: "desc" }, take: 20 },
          },
        },
        attachmentFolders: { orderBy: { sortOrder: "asc" } },
        tasks: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          // The assignee and contact are columns the task table can show, so
          // they're joined here rather than fetched per row.
          include: {
            assignee: { select: { id: true, name: true } },
            contact: { select: { id: true, name: true } },
          },
        },
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
          include: {
            _count: { select: { fields: true } },
            // Which file each run read. Several PDFs on one transaction all
            // produce runs into the same list, and without the filename the
            // list is three identical "Needs review" rows with no way to tell
            // which document any of them came from.
            document: { select: { filename: true } },
          },
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
    const [contacts, clients, plans, templates, attachmentTemplates, dateTemplates] =
      await Promise.all([
        tx.contact.findMany({
          orderBy: { name: "asc" },
          include: { parties: { select: { role: true } } },
        }),
        tx.client.findMany({ orderBy: { name: "asc" } }),
        tx.actionPlan.findMany({
          orderBy: { name: "asc" },
          include: { _count: { select: { tasks: true } } },
        }),
        tx.docTemplate.findMany({ orderBy: { name: "asc" } }),
        tx.attachmentTemplate.findMany({
          orderBy: { name: "asc" },
          include: { _count: { select: { items: true } } },
        }),
        tx.dateTemplate.findMany({ orderBy: { name: "asc" } }),
      ]);
    const emailTemplates = await tx.emailTemplate.findMany({
      orderBy: { name: "asc" },
      include: { group: { select: { name: true } } },
    });
    return {
      txn,
      contacts,
      clients,
      plans,
      templates,
      emailTemplates,
      attachmentTemplates,
      dateTemplates,
    };
  });
  if (!data) notFound();
  const {
    txn,
    contacts,
    clients,
    plans,
    templates,
    emailTemplates,
    attachmentTemplates,
    dateTemplates,
  } = data;

  // A date template selected from the picker below: computed suggestions for
  // its items, so the confirm form shows a proposed value per date instead
  // of asking the TC to type every one from scratch.
  const selectedDateTemplate = dateTemplate
    ? dateTemplates.find((t) => t.id === dateTemplate)
    : undefined;
  const dateTemplatePreview = selectedDateTemplate
    ? await previewDateTemplate(tenantId, txn.id, selectedDateTemplate.id)
    : [];

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

  // The Attachments tab is one list: every row, grouped into its folder, with
  // progress per folder and across the file. See lib/attachments.ts for what
  // counts as done and why omitted rows leave the denominator.
  // Filtering happens before grouping so a folder that loses every row loses
  // its heading too — see filterAttachments. The totals stay off the filtered
  // set: "6 of 9" is a fact about the file, and a search that made it read
  // "1 of 1" would be lying about the deal.
  const attachmentGroupsAll = groupAttachments(
    filterAttachments(txn.attachments, attachFilter),
    txn.attachmentFolders,
  );
  // An empty folder normally stays visible — it's a statement that something
  // is expected there. Under a filter it means the opposite, so a search that
  // matched nothing in "Listing" drops the heading rather than implying it did.
  const attachmentGroups = attachFiltered
    ? attachmentGroupsAll.filter((g) => g.rows.length > 0)
    : attachmentGroupsAll;
  // Every count on the tab is a fact about the file, never about the filter.
  // "Hide received" would otherwise turn a finished folder into "0/7 0%",
  // which is the opposite of the truth and the one thing these numbers exist
  // to tell you.
  const trueProgress = new Map(
    groupAttachments(txn.attachments, txn.attachmentFolders).map((g) => [g.folderId, g.progress]),
  );
  const attachmentTotals = progressOf(txn.attachments);
  const onlyUngrouped = attachmentGroups.length === 1 && attachmentGroups[0].folderId === null;
  // Somewhere for a mis-filed document to go: the rows still waiting on one.
  const emptyRows = txn.attachments.filter((a) => !a.documentId && !a.omittedAt);
  // In the order the list actually shows them. currentDocs is in document
  // insert order, which is *not* the order on screen once rows are grouped
  // into folders — and "combine these, in this order" is only trustworthy if
  // the order you can see is the order you get.
  // Who can sign anything on this file. Derived from participants, so adding
  // the buyer's agent makes them appear on every tracked row at once.
  const signers = signerParties(txn.parties);
  const pdfDocs = attachmentGroups
    .flatMap((g) => g.rows)
    .map((r) => r.document)
    .filter((d): d is NonNullable<typeof d> => !!d && d.contentType === "application/pdf");

  // Contract-governed dates the coordinator has asked to change but that the
  // paperwork hasn't caught up with. Shown next to the date they'd replace.
  const proposedDates = (txn.proposedDates as Record<string, string> | null) ?? {};

  // Workspace contacts as the picker wants them — email as the disambiguating
  // second line, falling back to phone for a contact with no email on file.
  // Shared by the Parties card and the Agents & Commissions section further
  // down, so this is built once rather than per consumer.
  const contactOptions = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    hint: c.email ?? c.phone,
  }));

  // Buyers, sellers, and third parties from any transaction don't belong in
  // the agent picker just because they're a contact somewhere — see
  // isAgentEligible.
  const agentContactOptions = contacts
    .filter((c) => isAgentEligible(c.parties))
    .map((c) => ({ id: c.id, name: c.name, hint: c.email ?? c.phone }));

  // The most recent extraction run per document, so a file that has already
  // been read says so on its own row instead of only appearing in the runs
  // list further down — where nothing tied a run back to its document.
  // extractions arrive newest-first, so the first hit per id is the latest.
  const latestExtractionByDoc = new Map<string, (typeof txn.extractions)[number]>();
  for (const ex of txn.extractions) {
    if (!latestExtractionByDoc.has(ex.documentId)) latestExtractionByDoc.set(ex.documentId, ex);
  }

  // This person's task-table layout for this workspace. One preference across
  // every transaction — see saveTaskColumns.
  const myMember = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId: session.user.id },
    select: { tablePrefs: true },
  });
  const taskColumns = resolveTaskColumns(
    (myMember?.tablePrefs as { taskColumns?: unknown } | null)?.taskColumns,
  );

  // The Handbook notes kept on this file itself. The pooled recap that also
  // gathers the client's and the parties' notes is Stage 3; this is only the
  // file's own list, so a standing instruction can be recorded where it
  // applies to one deal rather than to every deal that client ever brings.
  const hb = await handbookState(tenantId);

  // One query for every note that could bear on this file: its own, its
  // client's, and those of the people who are parties to it. Fetched together
  // rather than per-subject because the recap needs all of them at once, and
  // four round trips to render one panel is three too many.
  const partyContactIds = txn.parties.map((p) => p.contactId);
  const allHandbookNotes = hb.notes
    ? await withTenant(tenantId, (tx) =>
        tx.handbookNote.findMany({
          where: {
            OR: [
              { subjectType: "TRANSACTION", subjectId: id },
              ...(txn.clientId
                ? [{ subjectType: "CLIENT" as const, subjectId: txn.clientId }]
                : []),
              ...(partyContactIds.length > 0
                ? [{ subjectType: "CONTACT" as const, subjectId: { in: partyContactIds } }]
                : []),
            ],
          },
          orderBy: { createdAt: "desc" },
        }),
      )
    : [];

  const notesFor = (type: string, subjectId: string) =>
    allHandbookNotes.filter((n) => n.subjectType === type && n.subjectId === subjectId);
  const handbookNotes = notesFor("TRANSACTION", id);

  // Pooling, expiry and the exclusion of notes about people all live in
  // lib/handbook.ts so they stay tested — see poolForTransaction.
  const handbookPool = hb.notes
    ? poolForTransaction(
        {
          transaction: { id, label: txn.propertyAddress ?? "This file", notes: handbookNotes },
          client: txn.client
            ? {
                id: txn.client.id,
                label: txn.client.name,
                notes: notesFor("CLIENT", txn.client.id),
              }
            : null,
          contacts: txn.parties.map((p) => ({
            id: p.contactId,
            label: p.contact.name,
            notes: notesFor("CONTACT", p.contactId),
          })),
        },
        new Date(),
      )
    : [];

  // Grades ride along with the notes: "do not accept work" is the single most
  // important thing on the screen when it applies, and it isn't a note.
  const handbookGrades: RecapGrade[] = hb.notes
    ? [
        ...(txn.client?.handbookGrade
          ? [
              {
                label: txn.client.name,
                grade: txn.client.handbookGrade,
                reason: txn.client.handbookGradeNote,
                href: `/dashboard/clients/${txn.client.id}`,
              },
            ]
          : []),
        ...txn.parties
          .filter((p) => p.contact.handbookGrade)
          .map((p) => ({
            label: p.contact.name,
            grade: p.contact.handbookGrade as NonNullable<typeof p.contact.handbookGrade>,
            reason: p.contact.handbookGradeNote,
            href: `/dashboard/contacts/${p.contactId}`,
          })),
      ]
    : [];

  // Compliance: the current round drives the tab; older rounds stay as history.
  const currentRound = txn.compliance.find((c) => c.isCurrent) ?? null;
  // Feeds the side-rail card. "off" and "no-client" are legitimate states with
  // their own copy, not failures to show a number.
  const complianceState: "on" | "off" | "no-round" | "no-client" = !txn.client
    ? "no-client"
    : !txn.client.complianceEnabled
      ? "off"
      : currentRound
        ? "on"
        : "no-round";
  const complianceStats = currentRound ? complianceProgress(currentRound.slots) : null;
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
  const recentActivityLog = alert ? await recentActivity(tenantId, txn.id) : [];

  // Money on this file: every invoice touching it (directly or via a line on
  // a consolidated invoice), and the attributed billed/paid totals. Hidden
  // from guests — outside coverage staff work the file, not the money.
  const billingInvoices = !billing.view
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
  const { suggested: suggestedTemplates } = suggestForTask(emailTemplates, emailTaskTitle);
  // Grouped for the "start from a template" dropdown — named folders first
  // (alphabetically), then anything unfiled last. Prospecting templates
  // (Client outreach) aren't about any one file, so they're left out here —
  // still fully available from the template library.
  const emailTemplateGroupMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const t of emailTemplates) {
    if (t.group?.name === PROSPECTING_TEMPLATE_GROUP) continue;
    const key = t.group?.name ?? "No folder";
    const list = emailTemplateGroupMap.get(key) ?? [];
    list.push({ id: t.id, name: t.name.replace(" (Sample)", "") });
    emailTemplateGroupMap.set(key, list);
  }
  const emailTemplateGroups = [...emailTemplateGroupMap.entries()]
    .sort(([a], [b]) => (a === "No folder" ? 1 : b === "No folder" ? -1 : a.localeCompare(b)))
    .map(([label, items]) => ({ label, items }));
  const scheduledEmails = await prisma.emailOutbox.findMany({
    where: { tenantId, transactionId: txn.id, sentAt: null, canceledAt: null },
    orderBy: { sendAt: "asc" },
  });
  // Only offered when this coordinator has a working mailbox connected —
  // see /dashboard/profile.
  const myMailbox = await prisma.nylasGrant.findUnique({
    where: { userId: session.user.id },
    select: { email: true, status: true },
  });
  const canSendAsMe = myMailbox?.status === "valid";
  const attachPrechecked = new Set<string>();
  let composeSubject = "";
  let composeBody = "";
  let composeTo = "";
  let composeCc = "";
  const selectedEmailTemplate = emailTemplate
    ? emailTemplates.find((t) => t.id === emailTemplate)
    : undefined;
  if (selectedEmailTemplate) {
    const task = emailTask ? txn.tasks.find((t) => t.id === emailTask) : undefined;
    const merge = {
      ...(await buildTemplateMergeContext(tenantId, txn.id, session.user)),
      task_title: task?.title ?? "",
      task_due: task?.dueDate ? fmtDate(task.dueDate) : "",
    };
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
    composeTo = renderMerge(selectedEmailTemplate.toDefault ?? "", merge);
    composeCc = renderMerge(selectedEmailTemplate.ccDefault ?? "", merge);
  }
  // Recipients chosen on the Participants tab (single click-to-email, or a
  // checked selection) win over a template's default To — picking people
  // explicitly is a more specific signal than a template's usual audience.
  const emailToList = Array.isArray(emailTo) ? emailTo : emailTo ? [emailTo] : [];
  if (emailToList.length > 0) {
    composeTo = emailToList.join(", ");
  }
  // Arriving from a document's envelope icon: that file is already ticked, so
  // "send me the inspection report" is one click and a recipient.
  for (const docId of Array.isArray(attachDoc) ? attachDoc : attachDoc ? [attachDoc] : []) {
    if (currentDocs.some((d) => d.id === docId)) attachPrechecked.add(docId);
  }

  const customFields = (txn.customFields as Record<string, string> | null) ?? {};
  const contractParties = (txn.contractParties as ContractParty[] | null) ?? [];
  const today = fmtDate(new Date());
  const openCount = txn.tasks.filter((t) => t.status === "OPEN").length;

  // Workspace CC address (copy-to-clipboard pill in the header).
  const orgEmail = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { emailSettings: true, timeTrackingEnabled: true, privateLendingEnabled: true },
  });
  // Which screen this file gets. A private lender's files are loans, so they
  // are laid out differently; everything else keeps the sale screen. The
  // lending layout itself is the next phase, so both currently render the
  // standard body and only the header says which is in play.
  const layout = transactionLayout(txn.client?.type, {
    privateLendingEnabled: orgEmail?.privateLendingEnabled ?? false,
  });
  const ccEmail = parseEmailSettings(orgEmail?.emailSettings).cc ?? "";

  // The same signature-card context the real send builds, reused here so the
  // compose form's Preview button shows what will actually go out — cards,
  // colour, and all — rather than a guess at it.
  const emailCtx = await emailContextForTransaction(tenantId, txn.id, session.user);
  const signatureOptions = await withTenant(tenantId, (tx) =>
    tx.emailSignature.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
  );
  const defaultSignatureId = signatureOptions.find((s) => s.isDefault)?.id ?? "none";
  // The compose form's tc prop is only ever the fallback for "Just my own
  // info" — emailCtx.tcCard already picked the default signature block, so
  // reusing it here would make that explicit "use my own info" choice
  // silently show the default block's name instead of the sender's own.
  const ownTcCard: EmailContact | null = emailCtx
    ? {
        heading: "Your transaction coordinator",
        name: session.user.name || emailCtx.org.name,
        company: emailCtx.org.name,
        email: session.user.email,
        phone: await tcPhone(session.user),
      }
    : null;

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

  // Two things a coordinator needs flagged the moment they open a file: a
  // side with nobody recorded (buyer or seller — real estate contracts always
  // have both), and a contract that isn't actually signed yet, which makes
  // every date and dollar figure on the file provisional.
  const missingSides = (["BUYER", "SELLER"] as const).filter(
    (role) => !txn.parties.some((p) => p.role === role),
  );
  // Ours first, then the third parties, then the other side's people.
  const groupedParties = groupPartiesBySide(txn.parties, txn.side);
  /**
   * The messages on this file a participant appears on, for the small edit
   * dialog. Matched off `txn.emails`, which is already loaded for the Emails
   * tab, so this costs nothing extra. Address match as well as contactId
   * because mail that arrived before the contact existed carries only the
   * address.
   */
  const emailsFor = (contactId: string, address: string | null) => {
    const addr = address?.toLowerCase();
    return txn.emails
      .filter(
        (e) =>
          e.contactId === contactId ||
          (addr &&
            (e.toAddr.toLowerCase().includes(addr) || e.fromAddr.toLowerCase().includes(addr))),
      )
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        subject: e.subject,
        direction: e.direction,
        createdAt: fmtDate(e.createdAt),
      }));
  };
  // "Did you send that to the lender?" — answered from what actually went
  // out, on the row for the thing that was sent.
  const [sentDocs, sentLinks] = await Promise.all([
    lastSentByDocument(tenantId, txn.id),
    lastSentByPortalLink(tenantId, txn.id),
  ]);
  const latestExtraction = txn.extractions[0] ?? null;
  const execNotice = latestExtraction
    ? executionNotice((latestExtraction.execution as ExecutionCheck | null) ?? null)
    : null;
  const showExecNotice = execNotice && execNotice.tone !== "success";

  return (
    <div className="flex flex-col gap-4">
      {orgEmail?.timeTrackingEnabled && <TimeTrackingPing transactionId={txn.id} />}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: "Transactions", href: "/dashboard/transactions" },
              { label: txn.propertyAddress },
            ]}
          />
          <h1 data-tour="txn-header" className="flex items-center gap-2 text-xl font-semibold">
            <SideBadge side={txn.side} labels={labels} size="md" />
            {txn.propertyAddress}
            {layout === "lending" && <Badge tone="neutral">Private lending</Badge>}
          </h1>
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
          {billing.view && (
            <Link
              href={`/dashboard/transactions/${txn.id}?tab=billing`}
              title="Billing for this file"
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm shadow-xs transition hover:border-stone-300 hover:bg-stone-50"
            >
              {fileMoney.billedCents > 0 ? (
                <>
                  <span className="text-stone-500">Invoiced</span>
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
                  <span className="text-stone-500">Not invoiced</span>
                  <span className="tabular-nums font-medium text-amber-700">
                    {fmtCents(txn.expectedFeeCents)}
                  </span>
                </>
              )}
            </Link>
          )}
        </div>
      </div>

      {(missingSides.length > 0 || showExecNotice) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm">
          {missingSides.map((role) => (
            <Link
              key={role}
              href={`/dashboard/transactions/${txn.id}?tab=participants`}
              className="flex items-center gap-1.5 font-medium text-red-700 hover:underline"
            >
              <Warning size={14} weight="fill" className="text-red-600" aria-hidden />
              No {ROLE_LABEL[role]} Participants
            </Link>
          ))}
          {showExecNotice && execNotice && (
            <Link
              href={
                latestExtraction
                  ? `/dashboard/transactions/${txn.id}/extractions/${latestExtraction.id}`
                  : `/dashboard/transactions/${txn.id}`
              }
              className="flex items-center gap-1.5 font-medium text-red-700 hover:underline"
            >
              <Warning size={14} weight="fill" className="text-red-600" aria-hidden />
              {execNotice.headline}
              {execNotice.missing.length > 0 && ` — missing: ${execNotice.missing.join(", ")}`}
            </Link>
          )}
        </div>
      )}

      {alert && <ActivityPanel alert={alert} recent={recentActivityLog} />}

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
            href={`/dashboard/transactions/${txn.id}?tab=team`}
            className="font-medium text-brand-700 underline"
          >
            Assign someone
          </Link>
        </p>
      )}

      {/* items-start + sticky on the sidebar: the tab content (a 40+ row
          task list, a long email thread) is routinely much taller than Key
          dates/Participants/Custom fields, and without this the sidebar's
          grid cell stretched to match, leaving a dead gap below the last
          card while the tab content kept going. Same bug and fix as the
          dashboard home rail. */}
      <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:order-1">
          {/* First in the sidebar, above the dates: this is what someone needs
              to have read *before* they act on the file, and anything further
              down gets scrolled past. Renders nothing when there is nothing
              to say, so it never becomes furniture people learn to ignore. */}
          <HandbookRecap notes={handbookPool} grades={handbookGrades} />
          {/* Can this file close? Answered on every tab, not just inside the
              Compliance one. */}
          <ComplianceProgressCard
            transactionId={txn.id}
            state={complianceState}
            progress={complianceStats}
          />
          <SectionCard
            tour="txn-key-dates"
            title="Key dates"
            icon={<CalendarBlank size={15} weight="fill" aria-hidden />}
            action={
              <PanelJump
                href={`/dashboard/transactions/${txn.id}?tab=dates`}
                label="Open the Details tab"
              />
            }
            bodyClassName="p-3"
          >
            <dl className="flex flex-col gap-1.5 text-sm">
              {(
                [
                  ["listDate", txn.listDate],
                  ["onMarketDate", txn.onMarketDate],
                  ["contractDate", txn.contractDate],
                  ["closeDate", txn.closeDate],
                  ["mortgageCommitmentDate", txn.mortgageCommitmentDate],
                  ["inspectionDeadlineDate", txn.inspectionDeadlineDate],
                  ["earnestMoneyDueDate", txn.earnestMoneyDueDate],
                  ["expireDate", txn.expireDate],
                ] as const
              ).map(([field, d]) => (
                <KeyDateRow
                  key={field}
                  action={updateKeyDate}
                  transactionId={txn.id}
                  field={field}
                  label={KEY_DATE_LABELS[field]}
                  value={d ? d.toISOString().slice(0, 10) : ""}
                  display={fmtDate(d)}
                  governed={isGovernedDateField(field)}
                  proposed={proposedDates[field] ?? null}
                />
              ))}
            </dl>
          </SectionCard>
          <SectionCard
            title="Next deadlines"
            icon={<Clock size={15} weight="fill" aria-hidden />}
            action={
              <PanelJump
                href={`/dashboard/transactions/${txn.id}?tab=tasks`}
                label="Open the Tasks tab"
              />
            }
            bodyClassName="p-3"
          >
            <ul className="flex flex-col gap-1.5 text-sm">
              {txn.tasks
                .filter((t) => t.status === "OPEN" && t.dueDate)
                .slice(0, 6)
                .map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/dashboard/transactions/${txn.id}/tasks/${t.id}`}
                      className="flex justify-between gap-2 hover:text-brand-700"
                      title="Open this task"
                    >
                      <span className="truncate">{t.title}</span>
                      <span className="shrink-0 tabular-nums text-stone-400">
                        {fmtDayMonth(t.dueDate)}
                      </span>
                    </Link>
                  </li>
                ))}
              {txn.tasks.filter((t) => t.status === "OPEN" && t.dueDate).length === 0 && (
                <li className="text-stone-400">Nothing dated is open.</li>
              )}
            </ul>
          </SectionCard>
          <SectionCard
            title="Listing details"
            icon={<Tag size={15} weight="fill" aria-hidden />}
            action={
              <PanelJump
                href={`/dashboard/transactions/${txn.id}?tab=dates`}
                label="Open the Details tab"
              />
            }
            bodyClassName="p-3"
          >
            <dl className="flex flex-col gap-1.5 text-sm">
              <ListingDetailRow
                action={updateListingDetail}
                transactionId={txn.id}
                field="mlsId"
                label="MLS ID"
                value={txn.mlsId ?? ""}
                display={txn.mlsId ?? "—"}
                placeholder="MLS-102938"
              />
              <ListingDetailRow
                action={updateListingDetail}
                transactionId={txn.id}
                field="listPrice"
                label="List price"
                value={txn.listPrice != null ? String(txn.listPrice) : ""}
                display={fmtMoney(txn.listPrice)}
                inputMode="numeric"
                placeholder="450000"
              />
              <ListingDetailRow
                action={updateListingDetail}
                transactionId={txn.id}
                field="purchasePrice"
                label="Contract price"
                value={txn.purchasePrice != null ? String(txn.purchasePrice) : ""}
                display={fmtMoney(txn.purchasePrice)}
                inputMode="numeric"
                placeholder="450000"
              />
            </dl>
          </SectionCard>
          <SectionCard
            title="Participants"
            icon={<UsersThree size={15} weight="fill" aria-hidden />}
            count={txn.parties.length || undefined}
            action={
              <PanelJump
                href={`/dashboard/transactions/${txn.id}?tab=participants`}
                label="Open the Participants tab"
              />
            }
            bodyClassName="p-3"
          >
            {txn.parties.length > 0 ? (
              <ul className="mb-3 flex flex-col divide-y divide-stone-100">
                {groupedParties.map(({ party: p, group, firstOfGroup }) => (
                  <li key={p.id} className="flex flex-col">
                    {firstOfGroup && (
                      <span className="pt-2 text-[0.65rem] font-semibold uppercase tracking-wide text-stone-400">
                        {GROUP_LABEL[group]}
                      </span>
                    )}
                    <span className="flex items-center gap-2 py-1.5 text-sm">
                      <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-stone-400">
                        {ROLE_LABEL[p.role]}
                      </span>
                      <Link
                        href={`/dashboard/contacts/${p.contact.id}`}
                        className="min-w-0 flex-1 truncate font-medium text-brand-700 hover:underline"
                      >
                        {p.contact.name}
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm text-stone-400">No participants yet.</p>
            )}
            <Link
              href={`/dashboard/transactions/${txn.id}?tab=participants`}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Manage participants →
            </Link>
          </SectionCard>
          <SectionCard
            title="Custom fields"
            icon={<Textbox size={15} weight="fill" aria-hidden />}
            bodyClassName="p-3"
          >
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
          </SectionCard>
        </aside>
        <div className="flex min-w-0 flex-col gap-3 xl:order-2">
          {/* Two rows, because twelve tabs on one line wraps into an
              indistinguishable block. The active one is filled and underlined
              rather than merely un-greyed — at this count, "which tab am I on"
              has to be answerable at a glance from across the row. */}
          <nav className="flex flex-col gap-1 border-b border-stone-200 pb-1.5">
            <div className="flex flex-wrap gap-1">
              {TXN_TABS_PRIMARY.map(([key, labelText]) => (
                <Link
                  key={key}
                  href={`/dashboard/transactions/${txn.id}?tab=${key}`}
                  aria-current={tab === key ? "page" : undefined}
                  className={`rounded-lg border-b-2 px-3 py-1.5 text-sm transition-colors ${
                    tab === key
                      ? "border-brand-600 bg-brand-50 font-semibold text-brand-800"
                      : "border-transparent text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  }`}
                >
                  {labelText}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {TXN_TABS_SECONDARY.filter(([key]) => !(!billing.view && key === "billing")).map(
                ([key, labelText]) => (
                  <Link
                    key={key}
                    href={`/dashboard/transactions/${txn.id}?tab=${key}`}
                    aria-current={tab === key ? "page" : undefined}
                    className={`rounded-lg border-b-2 px-2.5 py-1 text-[13px] transition-colors ${
                      tab === key
                        ? "border-brand-600 bg-brand-50 font-semibold text-brand-800"
                        : "border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                    }`}
                  >
                    {labelText}
                  </Link>
                ),
              )}
            </div>
          </nav>
          {tab === "tasks" && (
            <SectionCard
              tour="txn-tasks"
              title="Tasks"
              icon={<CheckSquare size={15} weight="fill" aria-hidden />}
              count={`${openCount} open`}
              action={
                <>
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
                  <ColumnPicker
                    all={[...TASK_COLUMNS]}
                    groups={taskColumnGroups()}
                    selected={taskColumns.map((c) => c.key)}
                    action={saveTaskColumns}
                  />
                </>
              }
            >
              {txn.tasks.length === 0 ? (
                <p className="mb-3 text-sm text-stone-500">
                  No tasks yet — add one below or apply an action plan.
                </p>
              ) : (
                <div className="mb-4">
                  <TaskTable
                    tasks={txn.tasks}
                    columns={taskColumns}
                    transactionId={txn.id}
                    today={today}
                    toggleTask={toggleTask}
                    setTaskStatus={setTaskStatus}
                    setTaskNotes={setTaskNotes}
                    setTaskPriority={setTaskPriority}
                    setTaskDueDate={setTaskDueDate}
                    deleteTask={deleteTask}
                    emailHref={(t) =>
                      `/dashboard/transactions/${txn.id}?tab=emails&emailTask=${t.id}${
                        t.emailTemplateId ? `&emailTemplate=${t.emailTemplateId}` : ""
                      }`
                    }
                  />
                </div>
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
            </SectionCard>
          )}
          {tab === "documents" && (
            <div data-tour="txn-documents" className="flex flex-col gap-4">
              {splitError && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {splitError}
                </p>
              )}
              <SectionCard
                tour="txn-attachments"
                title="Attachments"
                icon={<FilePdf size={15} weight="fill" aria-hidden />}
                count={
                  attachmentTotals.total > 0
                    ? `${attachmentTotals.done} of ${attachmentTotals.total}`
                    : undefined
                }
                action={
                  <span className="flex items-center gap-2">
                    {txn.proFeaturesEnabled && (
                      <span className="rounded-full bg-brand-600/10 px-2 py-0.5 text-xs font-medium text-brand-700">
                        Pro AI on
                      </span>
                    )}
                    {currentDocs.length > 0 && (
                      // Lenders and clients ask for "the whole file" — one
                      // download rather than clicking each row in turn.
                      <a
                        href={`/api/transactions/${txn.id}/documents/zip`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 transition-colors hover:text-brand-700"
                      >
                        <Archive size={14} aria-hidden />
                        Download all
                      </a>
                    )}
                  </span>
                }
                bodyClassName="p-0"
              >
                <ScrollToHash />
                {/* One way in, at the top. The AI files it against the rows
                    below; anything it can't place lands ungrouped rather than
                    disappearing. */}
                <div className="border-b border-stone-100 p-3">
                  <DocumentDropZone transactionId={txn.id} linkAction={linkAttachmentDocument} />
                </div>

                {/* Search and the two hide-filters. A plain GET form: the
                    state belongs in the URL (shareable, survives every
                    revalidate) and this needs no JavaScript at all. */}
                {txn.attachments.length > 0 && (
                  <form
                    method="get"
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-stone-100 px-4 py-2"
                  >
                    <input type="hidden" name="tab" value="documents" />
                    <label className="sr-only" htmlFor="attach-search">
                      Search attachments
                    </label>
                    <input
                      id="attach-search"
                      name="aq"
                      defaultValue={attachQuery}
                      placeholder="Search this file…"
                      className={`${input} w-56 py-1 text-xs`}
                    />
                    <label className="flex items-center gap-1.5 text-xs text-stone-600">
                      <input
                        type="checkbox"
                        name="aHide"
                        value="complete"
                        defaultChecked={attachFilter.hideComplete}
                        className="h-3.5 w-3.5 accent-brand-600"
                      />
                      Hide received
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-stone-600">
                      <input
                        type="checkbox"
                        name="aHide"
                        value="omitted"
                        defaultChecked={attachFilter.hideOmitted}
                        className="h-3.5 w-3.5 accent-brand-600"
                      />
                      Hide N/A
                    </label>
                    <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                      Apply
                    </button>
                    {attachFiltered && (
                      <Link
                        href={`/dashboard/transactions/${txn.id}?tab=documents`}
                        className="text-xs text-stone-500 transition-colors hover:text-brand-700"
                      >
                        Clear
                      </Link>
                    )}
                    {attachFiltered && (
                      <span className="ml-auto text-xs text-stone-400">
                        Showing {attachmentGroups.reduce((n, g) => n + g.rows.length, 0)} of{" "}
                        {txn.attachments.length}
                      </span>
                    )}
                  </form>
                )}

                {/* The bulk bar. The form is empty of controls — the
                    checkboxes down the list point at it by id, and each
                    button carries its own formAction, so the browser does
                    the dispatch. */}
                {txn.attachments.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-2">
                    <form id={BULK_FORM_ID} action={bulkOmitAttachments} className="contents">
                      <input type="hidden" name="id" value={txn.id} />
                      <BulkSelectSummary formId={BULK_FORM_ID} />
                      <span className="ml-auto flex flex-wrap items-center gap-1.5">
                        <button
                          type="submit"
                          formAction={bulkEmailAttachments}
                          className={`${btnGhost} px-2 py-1 text-xs`}
                        >
                          Email
                        </button>
                        <button
                          type="submit"
                          formAction={bulkZipAttachments}
                          className={`${btnGhost} px-2 py-1 text-xs`}
                        >
                          ZIP
                        </button>
                        {txn.attachmentFolders.length > 0 && (
                          <>
                            <select
                              name="bulkFolderId"
                              defaultValue=""
                              aria-label="Move selected to folder"
                              className={`${input} py-1 text-xs`}
                            >
                              <option value="">No folder</option>
                              {txn.attachmentFolders.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              formAction={bulkMoveAttachments}
                              className={`${btnGhost} px-2 py-1 text-xs`}
                            >
                              Move
                            </button>
                          </>
                        )}
                        <button
                          type="submit"
                          formAction={bulkOmitAttachments}
                          className={`${btnGhost} px-2 py-1 text-xs`}
                        >
                          Omit
                        </button>
                        <button
                          type="submit"
                          formAction={bulkIncludeAttachments}
                          className={`${btnGhost} px-2 py-1 text-xs`}
                        >
                          Include
                        </button>
                        <button
                          type="submit"
                          formAction={bulkDeleteAttachments}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                        >
                          Remove rows
                        </button>
                      </span>
                    </form>
                  </div>
                )}

                {attachmentGroups.length === 0 ? (
                  <div className="p-6">
                    {attachFiltered ? (
                      <EmptyState
                        title="Nothing matches"
                        hint="Clear the search or the filters above to see the whole list again."
                      />
                    ) : (
                      <EmptyState
                        title="Nothing on this file yet"
                        hint="Drop a PDF above, or add what you're waiting for with “Add” below — an action plan or attachment template fills the list in one go."
                      />
                    )}
                  </div>
                ) : (
                  attachmentGroups.map((group) => {
                    const progress = trueProgress.get(group.folderId) ?? group.progress;
                    return (
                      <details
                        key={group.folderId ?? "ungrouped"}
                        open
                        className="group border-b border-stone-100 last:border-0"
                      >
                        {/* With no folders in play the single "Ungrouped" header
                          is pure restatement of the card's own count, so it
                          collapses away and the rows read as one plain list. */}
                        <summary
                          className={`flex cursor-pointer select-none items-center gap-2 bg-stone-50/70 px-4 py-2 text-sm ${
                            onlyUngrouped ? "hidden" : ""
                          }`}
                        >
                          <span
                            className="inline-block text-stone-400 transition-transform group-open:rotate-90"
                            aria-hidden
                          >
                            ▸
                          </span>
                          <FolderSimple size={14} className="shrink-0 text-stone-400" aria-hidden />
                          <span className="font-medium text-stone-700">{group.name}</span>
                          <span className="ml-auto flex items-center gap-2 text-xs text-stone-500">
                            <span className="tabular-nums">
                              {progress.done}/{progress.total}
                            </span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 font-medium tabular-nums ${
                                progress.pct === 100
                                  ? "bg-brand-600/10 text-brand-700"
                                  : "bg-stone-200/70 text-stone-600"
                              }`}
                            >
                              {progress.pct}%
                            </span>
                          </span>
                        </summary>
                        {group.rows.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-stone-400">
                            Nothing filed here yet.
                          </p>
                        ) : (
                          <ul className="flex flex-col">
                            {group.rows.map((row) => {
                              const doc = row.document;
                              const state = attachmentState(row);
                              const full = doc ? docById.get(doc.id) : undefined;
                              const latest = doc ? latestExtractionByDoc.get(doc.id) : undefined;
                              const sent = doc ? sentDocs.get(doc.id) : undefined;
                              const priors = full ? priorVersions(full) : [];
                              return (
                                <li
                                  key={row.id}
                                  id={doc ? `doc-${doc.id}` : `row-${row.id}`}
                                  // scroll-mt clears the sticky header when a
                                  // #doc-<id> link jumps here from the document
                                  // library.
                                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-stone-100 px-4 py-2.5 scroll-mt-24 transition-colors last:border-0 hover:bg-stone-50/60"
                                >
                                  {/* Selection for the bulk bar. `form=` rather
                                    than nesting: this row already contains
                                    forms, and a form inside a form is invalid
                                    HTML that browsers silently drop. */}
                                  <input
                                    type="checkbox"
                                    form={BULK_FORM_ID}
                                    name="rowIds"
                                    value={row.id}
                                    data-bytes={doc?.sizeBytes ?? 0}
                                    aria-label={`Select ${row.label}`}
                                    className="h-3.5 w-3.5 shrink-0 accent-brand-600"
                                  />
                                  {/* The tick is the row's own state, not a
                                    read-out of whether a file is present —
                                    plenty of rows are settled without one. */}
                                  <form action={toggleAttachmentComplete} className="flex">
                                    <input type="hidden" name="id" value={txn.id} />
                                    <input type="hidden" name="rowId" value={row.id} />
                                    <button
                                      type="submit"
                                      aria-label={
                                        state === "complete"
                                          ? `Mark ${row.label} not received`
                                          : `Mark ${row.label} received`
                                      }
                                      className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] transition-colors ${
                                        state === "complete"
                                          ? "bg-brand-600 text-white hover:bg-brand-500"
                                          : state === "omitted"
                                            ? "border border-stone-200 bg-stone-100 text-stone-400"
                                            : "border border-dashed border-stone-300 text-transparent hover:border-brand-500"
                                      }`}
                                    >
                                      {state === "complete" ? "✓" : state === "omitted" ? "—" : "✓"}
                                    </button>
                                  </form>

                                  <span
                                    className={`font-medium ${
                                      state === "omitted"
                                        ? "text-stone-400 line-through"
                                        : doc
                                          ? "text-stone-800"
                                          : "text-amber-700"
                                    }`}
                                  >
                                    {row.label}
                                  </span>

                                  {row.required && !doc && state === "pending" && (
                                    <Badge tone="attention">Required</Badge>
                                  )}
                                  {!doc && row.visibleToClient && state !== "omitted" && (
                                    <span
                                      title={
                                        row.webUrl
                                          ? "The client can open this link from their portal"
                                          : "The client sees this listed as still needed"
                                      }
                                      className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500"
                                    >
                                      on portal
                                    </span>
                                  )}
                                  {full && full.version > 1 && (
                                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-medium text-stone-500">
                                      v{full.version}
                                    </span>
                                  )}
                                  {doc && doc._count.extractions > 0 && (
                                    <Badge tone="success">extracted</Badge>
                                  )}
                                  {row.notes.length > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs text-stone-400">
                                      <ChatCircle size={12} aria-hidden />
                                      {row.notes.length}
                                    </span>
                                  )}
                                  {state === "omitted" && row.omittedReason && (
                                    <span className="text-xs italic text-stone-400">
                                      N/A — {row.omittedReason}
                                    </span>
                                  )}

                                  {/* Not everything on a file is a file. A
                                    photographer's gallery or a county
                                    recorder page belongs on the checklist
                                    the same as a PDF does. */}
                                  {row.webUrl && (
                                    <a
                                      href={row.webUrl}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      title={row.webUrl}
                                      className="inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600 transition-colors hover:bg-stone-200 hover:text-brand-700"
                                    >
                                      <LinkIcon size={11} aria-hidden />
                                      {linkLabel(row.webUrl)}
                                    </a>
                                  )}

                                  {doc ? (
                                    <span className="text-xs text-stone-400">
                                      {(doc.sizeBytes / 1024).toFixed(0)} KB ·{" "}
                                      {fmtDate(doc.createdAt)}
                                      {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ""}
                                    </span>
                                  ) : (
                                    !row.webUrl && (
                                      <span className="text-xs text-stone-400">
                                        {state === "complete"
                                          ? "received — no file"
                                          : "no file yet"}
                                      </span>
                                    )
                                  )}

                                  {(() => {
                                    const sig = readSignatureState(row.signatureState);
                                    if (!sig || signers.length === 0) return null;
                                    const prog = signatureProgress(sig, signers);
                                    return (
                                      <span className="flex items-center gap-1">
                                        {signers.map((p) => {
                                          const signed = Boolean(sig[p.id]);
                                          return (
                                            <form
                                              key={p.id}
                                              action={toggleAttachmentSigner}
                                              className="flex"
                                            >
                                              <input type="hidden" name="id" value={txn.id} />
                                              <input type="hidden" name="rowId" value={row.id} />
                                              <input type="hidden" name="partyId" value={p.id} />
                                              <button
                                                type="submit"
                                                title={`${p.contact?.name ?? ROLE_LABEL[p.role] ?? p.role} — ${
                                                  signed ? "signed" : "not signed yet"
                                                }`}
                                                className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-semibold transition-colors ${
                                                  signed
                                                    ? "bg-brand-600 text-white hover:bg-brand-500"
                                                    : "border border-dashed border-stone-300 text-stone-400 hover:border-brand-500 hover:text-brand-700"
                                                }`}
                                              >
                                                {ROLE_ABBR[p.role] ?? "?"}
                                              </button>
                                            </form>
                                          );
                                        })}
                                        {/* One click for the overwhelmingly
                                          common case: it came back fully
                                          signed. */}
                                        {!prog.complete && (
                                          <form
                                            action={executeAttachmentSignatures}
                                            className="flex"
                                          >
                                            <input type="hidden" name="id" value={txn.id} />
                                            <input type="hidden" name="rowId" value={row.id} />
                                            <button
                                              type="submit"
                                              className="ml-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 transition-colors hover:text-brand-600"
                                            >
                                              Execute
                                            </button>
                                          </form>
                                        )}
                                      </span>
                                    );
                                  })()}

                                  <span className="ml-auto flex items-center gap-3">
                                    {doc && (
                                      <>
                                        {/* Straight to the compose form with this
                                          file already ticked — the client or
                                          the lender asked for this one
                                          document, not the whole file. */}
                                        <Link
                                          href={`/dashboard/transactions/${txn.id}?tab=emails&attachDoc=${doc.id}`}
                                          title={`Email ${doc.filename}`}
                                          aria-label={`Email ${doc.filename}`}
                                          className="text-stone-300 transition-colors hover:text-brand-700"
                                        >
                                          <Envelope size={15} aria-hidden />
                                        </Link>
                                        <VisibilityToggles
                                          kind="document"
                                          id={doc.id}
                                          transactionId={txn.id}
                                          visibleToAgent={doc.visibleToAgent}
                                          visibleToClient={doc.visibleToClient}
                                        />
                                        <a
                                          href={`/api/documents/${doc.id}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className={`${btnGhost} px-2.5 py-1 text-xs`}
                                        >
                                          View
                                        </a>
                                      </>
                                    )}
                                    {!doc && (
                                      <form action={uploadDocument} className="flex">
                                        <input type="hidden" name="transactionId" value={txn.id} />
                                        <input type="hidden" name="rowId" value={row.id} />
                                        <UploadOnChange ariaLabel={`Upload ${row.label}`} />
                                      </form>
                                    )}
                                    {/* Everything that changes what the row
                                      *means* lives here rather than as more
                                      buttons on the row: a checklist of twenty
                                      rows can't afford five controls each. */}
                                    <details className="relative">
                                      <summary
                                        aria-label={`Actions for ${row.label}`}
                                        className="flex cursor-pointer list-none items-center rounded px-1 text-stone-300 transition-colors hover:text-stone-700"
                                      >
                                        <DotsThree size={18} weight="bold" aria-hidden />
                                      </summary>
                                      <div className="absolute right-0 z-20 mt-1 flex w-64 flex-col gap-2 rounded-lg border border-stone-200 bg-white p-2.5 text-left shadow-lg">
                                        {/* Rows arrive named by whatever made
                                          them — a template's wording, or a
                                          filename like "scan_0142.pdf". */}
                                        <form
                                          action={renameAttachmentRow}
                                          className="flex flex-col gap-1"
                                        >
                                          <input type="hidden" name="id" value={txn.id} />
                                          <input type="hidden" name="rowId" value={row.id} />
                                          <span className="text-xs font-medium text-stone-500">
                                            Name
                                          </span>
                                          <span className="flex gap-1">
                                            <input
                                              name="label"
                                              required
                                              defaultValue={row.label}
                                              aria-label={`Rename ${row.label}`}
                                              className={`${input} py-1 text-xs`}
                                            />
                                            <button
                                              type="submit"
                                              className={`${btnGhost} px-2 py-1 text-xs`}
                                            >
                                              Save
                                            </button>
                                          </span>
                                        </form>
                                        <form
                                          action={setAttachmentWebUrl}
                                          className="flex flex-col gap-1 border-t border-stone-100 pt-2"
                                        >
                                          <input type="hidden" name="id" value={txn.id} />
                                          <input type="hidden" name="rowId" value={row.id} />
                                          <span className="text-xs font-medium text-stone-500">
                                            Web link
                                          </span>
                                          <span className="flex gap-1">
                                            <input
                                              name="webUrl"
                                              type="url"
                                              defaultValue={row.webUrl ?? ""}
                                              placeholder="https://…"
                                              aria-label={`Web link for ${row.label}`}
                                              className={`${input} py-1 text-xs`}
                                            />
                                            <button
                                              type="submit"
                                              className={`${btnGhost} px-2 py-1 text-xs`}
                                            >
                                              Set
                                            </button>
                                          </span>
                                        </form>
                                        {doc &&
                                          emptyRows.filter((r) => r.id !== row.id).length > 0 && (
                                            <form
                                              action={linkAttachmentDocument}
                                              className="flex flex-col gap-1"
                                            >
                                              <input type="hidden" name="id" value={txn.id} />
                                              <input
                                                type="hidden"
                                                name="documentId"
                                                value={doc.id}
                                              />
                                              <span className="text-xs font-medium text-stone-500">
                                                Move file to
                                              </span>
                                              <span className="flex gap-1">
                                                <select
                                                  name="rowId"
                                                  required
                                                  defaultValue=""
                                                  className={`${input} py-1 text-xs`}
                                                >
                                                  <option value="" disabled>
                                                    Choose a row…
                                                  </option>
                                                  {emptyRows
                                                    .filter((r) => r.id !== row.id)
                                                    .map((r) => (
                                                      <option key={r.id} value={r.id}>
                                                        {r.label}
                                                      </option>
                                                    ))}
                                                </select>
                                                <button
                                                  type="submit"
                                                  className={`${btnGhost} px-2 py-1 text-xs`}
                                                >
                                                  Move
                                                </button>
                                              </span>
                                            </form>
                                          )}
                                        <form
                                          action={setAttachmentFolder}
                                          className="flex flex-col gap-1"
                                        >
                                          <input type="hidden" name="id" value={txn.id} />
                                          <input type="hidden" name="rowId" value={row.id} />
                                          <span className="text-xs font-medium text-stone-500">
                                            Folder
                                          </span>
                                          <span className="flex gap-1">
                                            <select
                                              name="folderId"
                                              defaultValue={row.folderId ?? ""}
                                              className={`${input} py-1 text-xs`}
                                            >
                                              <option value="">No folder</option>
                                              {txn.attachmentFolders.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                  {f.name}
                                                </option>
                                              ))}
                                            </select>
                                            <button
                                              type="submit"
                                              className={`${btnGhost} px-2 py-1 text-xs`}
                                            >
                                              Set
                                            </button>
                                          </span>
                                        </form>
                                        <form
                                          action={addAttachmentNote}
                                          className="flex flex-col gap-1 border-t border-stone-100 pt-2"
                                        >
                                          <input type="hidden" name="id" value={txn.id} />
                                          <input type="hidden" name="rowId" value={row.id} />
                                          <span className="text-xs font-medium text-stone-500">
                                            Add a note
                                          </span>
                                          <textarea
                                            name="body"
                                            rows={2}
                                            required
                                            placeholder="Waiting on the lender…"
                                            className={`${input} text-xs`}
                                          />
                                          <button
                                            type="submit"
                                            className={`${btnGhost} self-start px-2 py-1 text-xs`}
                                          >
                                            Add note
                                          </button>
                                        </form>
                                        {!doc && (
                                          <form
                                            action={toggleAttachmentPortalVisible}
                                            className="border-t border-stone-100 pt-2"
                                          >
                                            <input type="hidden" name="id" value={txn.id} />
                                            <input type="hidden" name="rowId" value={row.id} />
                                            <button
                                              type="submit"
                                              className="text-xs font-medium text-brand-700 transition-colors hover:text-brand-600"
                                            >
                                              {row.visibleToClient
                                                ? "Hide from the client portal"
                                                : row.webUrl
                                                  ? "Share this link on the client portal"
                                                  : "Show on the client portal as still needed"}
                                            </button>
                                          </form>
                                        )}
                                        <form
                                          action={setAttachmentSignatureTracking}
                                          className="border-t border-stone-100 pt-2"
                                        >
                                          <input type="hidden" name="id" value={txn.id} />
                                          <input type="hidden" name="rowId" value={row.id} />
                                          <button
                                            type="submit"
                                            className="text-xs font-medium text-brand-700 transition-colors hover:text-brand-600"
                                          >
                                            {readSignatureState(row.signatureState)
                                              ? "Stop tracking signatures"
                                              : "Track signatures"}
                                          </button>
                                        </form>
                                        <form
                                          action={setAttachmentOmitted}
                                          className="flex flex-col gap-1 border-t border-stone-100 pt-2"
                                        >
                                          <input type="hidden" name="id" value={txn.id} />
                                          <input type="hidden" name="rowId" value={row.id} />
                                          {state === "omitted" ? (
                                            <button
                                              type="submit"
                                              className={`${btnGhost} self-start px-2 py-1 text-xs`}
                                            >
                                              Put back on the list
                                            </button>
                                          ) : (
                                            <>
                                              <span className="text-xs font-medium text-stone-500">
                                                Not applicable
                                              </span>
                                              <input
                                                name="reason"
                                                placeholder="Reason (optional)"
                                                className={`${input} py-1 text-xs`}
                                              />
                                              <button
                                                type="submit"
                                                className={`${btnGhost} self-start px-2 py-1 text-xs`}
                                              >
                                                Mark N/A
                                              </button>
                                            </>
                                          )}
                                        </form>
                                        <form
                                          action={removeAttachmentRow}
                                          className="border-t border-stone-100 pt-2"
                                        >
                                          <input type="hidden" name="id" value={txn.id} />
                                          <input type="hidden" name="rowId" value={row.id} />
                                          <button
                                            type="submit"
                                            className="text-xs font-medium text-red-700 transition-colors hover:text-red-800"
                                          >
                                            Remove this row
                                          </button>
                                        </form>
                                      </div>
                                    </details>
                                  </span>

                                  {sent && (
                                    <p className="w-full text-xs text-stone-400">
                                      <Envelope size={11} className="mr-1 inline" aria-hidden />
                                      {sent.summary} · {sent.actorName} · {fmtDate(sent.at)}
                                    </p>
                                  )}

                                  {row.notes.length > 0 && (
                                    <ul className="flex w-full flex-col gap-1 pl-8">
                                      {row.notes.map((note) => (
                                        <li
                                          key={note.id}
                                          className="flex items-start gap-2 text-xs text-stone-500"
                                        >
                                          <ChatCircle
                                            size={12}
                                            className="mt-0.5 shrink-0 text-stone-300"
                                            aria-hidden
                                          />
                                          <span className="min-w-0 flex-1">
                                            {note.body}
                                            <span className="ml-1.5 text-stone-400">
                                              — {note.authorName ?? "someone"},{" "}
                                              {fmtDate(note.createdAt)}
                                            </span>
                                          </span>
                                          <form action={deleteAttachmentNote}>
                                            <input type="hidden" name="id" value={txn.id} />
                                            <input type="hidden" name="noteId" value={note.id} />
                                            <button
                                              type="submit"
                                              aria-label="Delete this note"
                                              className="text-stone-300 transition-colors hover:text-red-600"
                                            >
                                              ✕
                                            </button>
                                          </form>
                                        </li>
                                      ))}
                                    </ul>
                                  )}

                                  {doc && (
                                    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 pl-8">
                                      {doc.contentType === "application/pdf" &&
                                        (proActive ? (
                                          <span className="flex flex-wrap items-center gap-2">
                                            <ExtractButton
                                              action={runExtraction}
                                              documentId={doc.id}
                                              label={
                                                latest ? "Extract again" : "Extract contract data"
                                              }
                                            />
                                            {latest && (
                                              <Link
                                                href={`/dashboard/transactions/${txn.id}/extractions/${latest.id}`}
                                                className="inline-flex items-center gap-1.5 text-xs hover:underline"
                                              >
                                                <ExtractionBadge status={latest.status} />
                                                <span className="text-stone-400">
                                                  {fmtDate(latest.createdAt)}
                                                </span>
                                              </Link>
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-stone-400">
                                            Enable pro features to extract
                                          </span>
                                        ))}
                                      <details>
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
                                            <input
                                              name="signer1Email"
                                              type="email"
                                              required
                                              className={input}
                                            />
                                          </label>
                                          <label className={label}>
                                            Signer 2 name
                                            <input name="signer2Name" className={input} />
                                          </label>
                                          <label className={label}>
                                            Signer 2 email
                                            <input
                                              name="signer2Email"
                                              type="email"
                                              className={input}
                                            />
                                          </label>
                                          <button type="submit" className={btnGhost}>
                                            Send
                                          </button>
                                        </form>
                                      </details>
                                      {doc.contentType === "application/pdf" && (
                                        <SplitPdfDialog
                                          action={splitDocument}
                                          transactionId={txn.id}
                                          documentId={doc.id}
                                          filename={doc.filename}
                                          folders={txn.attachmentFolders}
                                        />
                                      )}
                                      <details>
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
                                            The current file becomes a prior version — nothing is
                                            lost.
                                          </span>
                                        </form>
                                      </details>
                                      {priors.length > 0 && (
                                        <details>
                                          <summary className="cursor-pointer select-none text-xs text-stone-500 transition-colors hover:text-stone-700">
                                            {priors.length} prior version
                                            {priors.length === 1 ? "" : "s"}
                                          </summary>
                                          <ul className="mt-1.5 flex flex-col gap-1 border-l-2 border-stone-200 pl-3">
                                            {priors.map((p) => (
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
                                      <DangerDelete
                                        compact
                                        action={deleteDocument}
                                        label="Delete file"
                                        description="Permanently deletes this file."
                                        hidden={{ id: doc.id, transactionId: txn.id }}
                                      />
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </details>
                    );
                  })
                )}

                {/* Everything that puts a new row on the list, behind one
                    control — three separate always-open forms competing for
                    attention is what made this tab hard to read. */}
                <details className="border-t border-stone-100">
                  <summary className="flex cursor-pointer select-none items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-brand-700 transition-colors marker:text-brand-600 hover:text-brand-600">
                    <Plus size={14} weight="bold" aria-hidden />
                    Add
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-stone-100 bg-stone-50/60 p-4">
                    <form action={addAttachmentRow} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={txn.id} />
                      <label className={`${label} min-w-56 flex-1`}>
                        Expect a document
                        <input
                          name="label"
                          required
                          placeholder="Lead paint disclosure"
                          className={input}
                        />
                      </label>
                      {txn.attachmentFolders.length > 0 && (
                        <label className={label}>
                          Folder
                          <select name="folderId" defaultValue="" className={input}>
                            <option value="">No folder</option>
                            {txn.attachmentFolders.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <button type="submit" className={btnGhost}>
                        Add row
                      </button>
                    </form>
                    <form action={uploadDocument} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="transactionId" value={txn.id} />
                      <label className={`${label} min-w-56 flex-1`}>
                        Upload files (PDF, max 10 MB each)
                        <input
                          name="file"
                          type="file"
                          accept="application/pdf,.pdf"
                          multiple
                          required
                          className={input}
                        />
                      </label>
                      <button type="submit" className={btnGhost}>
                        Upload
                      </button>
                      <span className="pb-2 text-xs text-stone-400">
                        Each file gets its own row.
                      </span>
                    </form>
                    {/* One per line, because they arrive several at a time in
                        one email and a single-field form would be six round
                        trips. */}
                    <form action={addAttachmentWebLinks} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={txn.id} />
                      <label className={`${label} min-w-56 flex-1`}>
                        Add web links — one per line, or “Name | link”
                        <textarea
                          name="links"
                          rows={2}
                          required
                          placeholder={
                            "Photos | https://gallery.example.com/123\nhttps://recorder…"
                          }
                          className={input}
                        />
                      </label>
                      {txn.attachmentFolders.length > 0 && (
                        <label className={label}>
                          Folder
                          <select name="folderId" defaultValue="" className={input}>
                            <option value="">No folder</option>
                            {txn.attachmentFolders.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <button type="submit" className={btnGhost}>
                        Add links
                      </button>
                    </form>
                    {attachmentTemplates.length > 0 && (
                      <form
                        action={applyAttachmentTemplate}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="transactionId" value={txn.id} />
                        <label className={`${label} min-w-56 flex-1`}>
                          Apply an attachment template
                          <select
                            name="attachmentTemplateId"
                            required
                            className={input}
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Choose a checklist…
                            </option>
                            {attachmentTemplates.map((at) => (
                              <option key={at.id} value={at.id}>
                                {at.name} ({at._count.items})
                                {at.description ? ` — ${at.description}` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="submit" className={btnGhost}>
                          Apply
                        </button>
                      </form>
                    )}
                    {pdfDocs.length > 1 && (
                      <form
                        action={combineDocuments}
                        className="flex flex-col gap-2 border-t border-stone-200 pt-3"
                      >
                        <input type="hidden" name="transactionId" value={txn.id} />
                        <span className={label}>Combine PDFs into one</span>
                        <span className="flex flex-wrap gap-x-4 gap-y-1">
                          {pdfDocs.map((d) => (
                            <label
                              key={d.id}
                              className="flex items-center gap-1.5 text-sm text-stone-600"
                            >
                              <input
                                type="checkbox"
                                name="documentIds"
                                value={d.id}
                                className="h-4 w-4"
                              />
                              {d.filename}
                            </label>
                          ))}
                        </span>
                        {/* Pages land in the order shown above, which is the
                            order the list already reads in — a checkbox set
                            has no order of its own to honour. */}
                        <span className="flex flex-wrap items-end gap-2">
                          <label className={`${label} min-w-48 flex-1`}>
                            Name the combined file
                            <input name="name" placeholder="Closing package" className={input} />
                          </label>
                          {txn.attachmentFolders.length > 0 && (
                            <label className={label}>
                              Folder
                              <select name="folderId" defaultValue="" className={input}>
                                <option value="">No folder</option>
                                {txn.attachmentFolders.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          <button type="submit" className={btnGhost}>
                            Combine
                          </button>
                        </span>
                      </form>
                    )}
                    <div className="flex flex-col gap-2 border-t border-stone-200 pt-3">
                      <form
                        action={createAttachmentFolder}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="id" value={txn.id} />
                        <label className={`${label} min-w-56 flex-1`}>
                          New folder
                          <input name="name" required placeholder="Contract" className={input} />
                        </label>
                        <button type="submit" className={btnGhost}>
                          Create
                        </button>
                      </form>
                      {txn.attachmentFolders.map((folder) => (
                        <div key={folder.id} className="flex flex-wrap items-center gap-2">
                          <form
                            action={renameAttachmentFolder}
                            className="flex flex-1 items-center gap-1"
                          >
                            <input type="hidden" name="id" value={txn.id} />
                            <input type="hidden" name="folderId" value={folder.id} />
                            <FolderSimple
                              size={14}
                              className="shrink-0 text-stone-400"
                              aria-hidden
                            />
                            <input
                              name="name"
                              defaultValue={folder.name}
                              aria-label={`Rename ${folder.name}`}
                              className={`${input} py-1 text-xs`}
                            />
                            <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                              Rename
                            </button>
                          </form>
                          {/* Rows inside survive and fall back to ungrouped —
                              a folder is an arrangement, not a container. */}
                          <form action={deleteAttachmentFolder}>
                            <input type="hidden" name="id" value={txn.id} />
                            <input type="hidden" name="folderId" value={folder.id} />
                            <button
                              type="submit"
                              className="text-xs font-medium text-red-700 transition-colors hover:text-red-800"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                    {templates.length > 0 && (
                      <form action={generateDocument} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="transactionId" value={txn.id} />
                        <label className={`${label} min-w-56 flex-1`}>
                          Generate from a document template
                          <select
                            name="templateId"
                            className={input}
                            defaultValue={templates[0]?.id}
                          >
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
                  </div>
                </details>
              </SectionCard>

              {!proActive && (
                <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3">
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
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  No <code>ANTHROPIC_API_KEY</code> is configured — extraction runs will fail until
                  one is added to <code>.env</code>.
                </p>
              )}

              {txn.envelopes.length > 0 && (
                <SectionCard
                  title="Signature envelopes"
                  icon={<PenNib size={15} weight="fill" aria-hidden />}
                >
                  <ul className="flex flex-col">
                    {txn.envelopes.map((env) => {
                      const signers = (env.signers as Array<{ name: string; email: string }>) ?? [];
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
                              description="Removes this signature envelope."
                              hidden={{ id: env.id, transactionId: txn.id }}
                            />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </SectionCard>
              )}

              {txn.extractions.length > 0 && (
                <SectionCard
                  title="Recent extraction runs"
                  icon={<Sparkle size={15} weight="fill" aria-hidden />}
                >
                  <ul className="flex flex-col">
                    {txn.extractions.map((ex) => (
                      <li
                        key={ex.id}
                        className="flex flex-wrap items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                      >
                        <ExtractionBadge status={ex.status} />
                        <span className="font-medium">{ex.document.filename}</span>
                        <span className="text-xs text-stone-400">
                          {ex.model} · {fmtDate(ex.createdAt)}
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
                </SectionCard>
              )}
            </div>
          )}
          {tab === "vendors" && <VendorOrderTab tenantId={tenantId} transactionId={id} />}
          {tab === "billing" && billing.view && (
            <div className="flex flex-col gap-3">
              <SectionCard
                title="Billing"
                icon={<CurrencyDollar size={15} weight="fill" aria-hidden />}
                action={
                  <Link
                    href={`/dashboard/transactions/${txn.id}?tab=dates`}
                    className="text-xs text-brand-700 hover:underline"
                  >
                    {txn.expectedFeeCents == null
                      ? "Set the expected fee →"
                      : "Edit expected fee →"}
                  </Link>
                }
              >
                {/* The ledger strip: the five numbers a TC needs to trust a
                    file — matching the draft → issue → collect stages the
                    invoice tracker below shows one invoice at a time. */}
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
                      [
                        "Drafted",
                        fmtCents(draftedCents),
                        draftedCents > 0 ? "text-stone-500" : "text-stone-800",
                      ],
                      ["Invoiced", fmtCents(fileMoney.billedCents), "text-stone-800"],
                      [
                        "Paid",
                        fmtCents(fileMoney.paidCents),
                        fileMoney.paidCents > 0 ? "text-brand-700" : "text-stone-800",
                      ],
                      [
                        "Balance due",
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
                          : "invoiced"}
                        {draftedCents > 0 && (
                          <span className="text-stone-500">
                            {" "}
                            · {fmtCents(draftedCents)} drafted, not yet issued
                          </span>
                        )}
                        {remainingToDraftCents != null && remainingToDraftCents > 0 && (
                          <span className="text-amber-700">
                            {" "}
                            · {fmtCents(remainingToDraftCents)} not yet drafted
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })()}
              </SectionCard>

              <SectionCard
                title="Invoices on this file"
                icon={<Receipt size={15} weight="fill" aria-hidden />}
              >
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
                      const dueShown = money.totalCents - paidShown;
                      return (
                        <li key={inv.id} className="py-2">
                          <div className="flex flex-col gap-1 text-sm lg:flex-row lg:items-baseline lg:justify-between lg:gap-4">
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
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
                            </div>
                            <div className="grid shrink-0 grid-cols-[5.5rem_5.5rem_5.5rem] items-baseline gap-x-4 text-xs tabular-nums">
                              <span className="text-right font-medium text-stone-800">
                                {fmtCents(money.totalCents)}
                              </span>
                              <span
                                className={
                                  paidShown > 0
                                    ? "text-right text-brand-700"
                                    : "text-right text-stone-300"
                                }
                              >
                                {paidShown > 0 ? `${fmtCents(paidShown)} paid` : "—"}
                              </span>
                              <span
                                className={
                                  state !== "void" && state !== "draft" && dueShown > 0
                                    ? "text-right text-amber-700"
                                    : "text-right text-stone-300"
                                }
                              >
                                {state !== "void" && state !== "draft" && dueShown > 0
                                  ? `${fmtCents(dueShown)} due`
                                  : "—"}
                              </span>
                            </div>
                          </div>
                          <InvoiceStatusTracker state={state} className="mt-1.5" />
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
                          {billing.manage && (
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
                                    <PendingButton
                                      pendingLabel="Issuing…"
                                      className={`${btnGhost} px-2 py-1 text-xs`}
                                    >
                                      Issue invoice
                                    </PendingButton>
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
                                  <PendingButton
                                    pendingLabel="Marking paid…"
                                    className={`${btnGhost} px-2 py-1 text-xs`}
                                  >
                                    Mark paid
                                  </PendingButton>
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
              </SectionCard>

              {billing.comp && (
                <SectionCard
                  title="Payout & net"
                  icon={<ChartPieSlice size={15} weight="fill" aria-hidden />}
                >
                  {txn.assignees.filter((a) => a.feeCents != null || a.feePercentBp != null)
                    .length === 0 ? (
                    <p className="text-sm text-stone-500">
                      Nobody has a payout on this file yet — set a flat fee or a % share per person
                      under{" "}
                      <Link
                        href={`/dashboard/transactions/${txn.id}?tab=team`}
                        className="text-brand-700 hover:underline"
                      >
                        Team
                      </Link>
                      .
                    </p>
                  ) : (
                    (() => {
                      const withBasis = txn.assignees.filter(
                        (a) => a.feeCents != null || a.feePercentBp != null,
                      );
                      const totals = filePayoutTotals(
                        withBasis,
                        fileMoney.billedCents,
                        fileMoney.paidCents,
                      );
                      return (
                        <>
                          <ul className="mb-3 flex flex-col divide-y divide-stone-100">
                            {withBasis.map((a) => {
                              const p = assigneePayout(
                                a,
                                fileMoney.billedCents,
                                fileMoney.paidCents,
                              );
                              return (
                                <li
                                  key={a.id}
                                  className="flex flex-col gap-1 py-1.5 text-sm lg:flex-row lg:items-baseline lg:justify-between lg:gap-4"
                                >
                                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
                                    <span className="font-medium">{a.user.name}</span>
                                    <span className="text-xs text-stone-400">
                                      {a.feePercentBp != null
                                        ? `${formatPercentBp(a.feePercentBp)} of fee revenue`
                                        : "flat"}
                                    </span>
                                    {a.paymentItem && (
                                      <span className="text-xs text-stone-400">
                                        {a.paymentItem.request.status === "PAID"
                                          ? `paid ${fmtCents(a.paymentItem.feeCents)}`
                                          : `requested ${fmtCents(a.paymentItem.feeCents)}`}
                                      </span>
                                    )}
                                  </span>
                                  <span className="grid shrink-0 grid-cols-[7rem_7rem] gap-x-4 text-xs tabular-nums">
                                    <span className="text-right text-stone-600">
                                      earned {fmtCents(p.earnedCents)}
                                    </span>
                                    <span
                                      className={
                                        p.payableCents > 0
                                          ? "text-right text-brand-700"
                                          : "text-right text-stone-400"
                                      }
                                    >
                                      payable {fmtCents(p.payableCents)}
                                    </span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-stone-100 pt-2">
                            {(
                              [
                                ["Payouts earned", fmtCents(totals.earnedCents), "text-stone-800"],
                                ["Payable now", fmtCents(totals.payableCents), "text-stone-800"],
                                [
                                  "Net (billed − earned)",
                                  fmtCents(totals.netBilledCents),
                                  totals.netBilledCents >= 0 ? "text-brand-700" : "text-red-700",
                                ],
                                [
                                  "Net collected",
                                  fmtCents(totals.netCollectedCents),
                                  totals.netCollectedCents >= 0 ? "text-brand-700" : "text-red-700",
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
                                <span className={`tabular-nums text-sm font-semibold ${tone}`}>
                                  {value}
                                </span>
                              </div>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-stone-400">
                            {`Percent payouts are earned against what's billed and payable against what's collected; a pay request freezes the payable figure of the day.`}
                          </p>
                        </>
                      );
                    })()
                  )}
                </SectionCard>
              )}

              {billing.manage && (
                <SectionCard
                  title="Add a charge"
                  icon={<PlusCircle size={15} weight="fill" aria-hidden />}
                >
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
                      <PendingButton pendingLabel="Drafting…" className={btn}>
                        Draft the remaining fee — {fmtCents(remainingToDraftCents)}
                      </PendingButton>
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
                    <PendingButton pendingLabel="Adding…" className={btnGhost}>
                      Add charge
                    </PendingButton>
                  </form>
                </SectionCard>
              )}
            </div>
          )}
          {tab === "compliance" && (
            <SectionCard
              title="Compliance"
              icon={<ShieldCheck size={15} weight="fill" aria-hidden />}
              action={
                currentRound ? (
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
                ) : null
              }
            >
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
            </SectionCard>
          )}
          {tab === "dates" && (
            <>
              <SectionCard
                title="Contract-governed dates"
                icon={<CalendarCheck size={15} weight="fill" aria-hidden />}
              >
                <p className="mb-3 text-sm text-stone-500">
                  The contract is the source of truth. Changing the contract or closing date creates
                  an amendment to-do; the date only moves — and dependent task deadlines only
                  recompute — once you confirm the amendment is executed.
                </p>
                {(() => {
                  const entries = Object.entries(proposedDates) as Array<
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
              </SectionCard>

              {dateTemplates.length > 0 && (
                <SectionCard
                  title="Apply a key-dates template"
                  icon={<CalendarBlank size={15} weight="fill" aria-hidden />}
                >
                  <p className="mb-3 text-sm text-stone-500">
                    Choose a template to see its suggested dates for this file — nothing is written
                    until you confirm each one below. A governed date (contract or close) still
                    follows the amendment rule rather than applying directly.
                  </p>
                  <form
                    action={`/dashboard/transactions/${txn.id}`}
                    className="mb-3 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="tab" value="dates" />
                    <label className={label}>
                      Template
                      <select
                        name="dateTemplate"
                        className={input}
                        defaultValue={selectedDateTemplate?.id ?? ""}
                      >
                        <option value="">Choose a template…</option>
                        {dateTemplates.map((dt) => (
                          <option key={dt.id} value={dt.id}>
                            {dt.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className={btnGhost}>
                      Preview
                    </button>
                  </form>
                  {selectedDateTemplate && dateTemplatePreview.length > 0 && (
                    <form action={applyDateTemplateValues} className="flex flex-col gap-3">
                      <input type="hidden" name="transactionId" value={txn.id} />
                      <input type="hidden" name="dateTemplateId" value={selectedDateTemplate.id} />
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {dateTemplatePreview.map((item) => (
                          <label key={item.id} className={label}>
                            <input type="hidden" name="dateKey" value={item.dateKey} />
                            {item.label}
                            <input
                              type="date"
                              name={`value:${item.dateKey}`}
                              defaultValue={item.suggested ?? ""}
                              className={input}
                            />
                          </label>
                        ))}
                      </div>
                      <button type="submit" className={`${btn} self-start`}>
                        Apply these dates
                      </button>
                    </form>
                  )}
                </SectionCard>
              )}

              <SectionCard
                title="Details"
                icon={<ListBullets size={15} weight="fill" aria-hidden />}
              >
                <form
                  action={updateTransaction}
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                >
                  <input type="hidden" name="id" value={txn.id} />
                  <div className="lg:col-span-2">
                    <AddressAutocomplete
                      name="propertyAddress"
                      label="Property address"
                      defaultValue={txn.propertyAddress}
                      fills={{ city: "city", state: "state", zip: "zip" }}
                    />
                  </div>
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
                  <StatusSelect defaultValue={txn.status} />
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
                  {/* The side panels carry the list/contract money and dates.
                      Before this they weren't on the form at all, which meant
                      every save nulled listPrice, listDate, onMarketDate,
                      expireDate and mlsId — updateTransaction reads each one
                      unconditionally, and a field absent from the payload
                      reads as blank. */}
                  <SideFields
                    labels={labels}
                    className="sm:col-span-2 lg:col-span-4"
                    values={{
                      listPrice: txn.listPrice,
                      listDate: txn.listDate ? fmtDate(txn.listDate) : "",
                      onMarketDate: txn.onMarketDate ? fmtDate(txn.onMarketDate) : "",
                      expireDate: txn.expireDate ? fmtDate(txn.expireDate) : "",
                      purchasePrice: txn.purchasePrice,
                      contractDate: txn.contractDate ? fmtDate(txn.contractDate) : "",
                    }}
                  />
                  {/* Agents and commission. The TC/assistant slots are off
                      here: Participants already manages assignment, with
                      per-person fees and no cap of two. */}
                  <div className="sm:col-span-2 lg:col-span-4">
                    <AgentsCommissions
                      includeAssignees={false}
                      contacts={agentContactOptions}
                      users={[]}
                      clientTypes={Object.fromEntries(clients.map((c) => [c.id, c.type]))}
                      defaults={{
                        clientId: txn.clientId,
                        primaryAgentContactId: txn.primaryAgentContactId,
                        coAgentContactId: txn.coAgentContactId,
                        commissionPct: txn.commissionPct,
                        estimatedGrossCents: txn.estimatedGrossCents,
                        actualGrossCents: txn.actualGrossCents,
                      }}
                    />
                  </div>
                  <label className={`${label} lg:col-span-2`}>
                    MLS ID
                    <input name="mlsId" defaultValue={txn.mlsId ?? ""} className={input} />
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
              </SectionCard>
            </>
          )}
          {tab === "participants" && (
            <SectionCard
              title="Participants"
              icon={<UsersThree size={15} weight="fill" aria-hidden />}
            >
              <p className="mb-3 text-sm text-stone-500">
                Everyone on this file who isn't your team — buyer, seller, agents, lender, title,
                and more. Buyers and sellers open a short form for the details that matter on this
                file; everyone else opens their full contact record. Use "edit" on any row to fix a
                company, phone or email in place.
              </p>
              <details className="mb-4">
                <summary className={`${btnAdd} w-fit list-none`}>+ Add participant</summary>
                <form action={addParty} className={`${card} mt-3 flex flex-wrap items-end gap-3`}>
                  <input type="hidden" name="transactionId" value={txn.id} />
                  <label className={label}>
                    Role
                    <select name="role" defaultValue="BUYER" className={input}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="min-w-[13rem] flex-1">
                    <EntityPicker
                      name="contactId"
                      label="Contact"
                      options={contactOptions}
                      onCreate={createContactByName}
                      createHint="Add contact"
                      placeholder="Search contacts…"
                      autoSubmitOnCreate
                    />
                  </div>
                  <button type="submit" className={btn}>
                    Add
                  </button>
                </form>
              </details>

              {txn.parties.length === 0 ? (
                <p className="text-sm text-stone-400">No participants yet — add one above.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <form
                    id="email-participants-form"
                    method="GET"
                    action={`/dashboard/transactions/${txn.id}`}
                  >
                    <input type="hidden" name="tab" value="emails" />
                  </form>
                  <div className={tableWrap}>
                    <table className="w-full text-left">
                      <thead>
                        <tr>
                          <th className={th} />
                          <th className={th}>Role</th>
                          <th className={th}>Name</th>
                          <th className={th}>Company</th>
                          <th className={th}>Phone</th>
                          <th className={th}>Email</th>
                          <th className={th} />
                        </tr>
                      </thead>
                      <tbody>
                        {groupedParties.map(({ party: p, group, firstOfGroup }) => (
                          <Fragment key={p.id}>
                            {firstOfGroup && (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="bg-stone-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-stone-500"
                                >
                                  {GROUP_LABEL[group]}
                                </td>
                              </tr>
                            )}
                            <tr className={trHover}>
                              <td className={td}>
                                {p.contact.email && (
                                  <input
                                    type="checkbox"
                                    name="emailTo"
                                    value={p.contact.email}
                                    form="email-participants-form"
                                    defaultChecked
                                    aria-label={`Include ${p.contact.name} in email`}
                                    className="accent-brand-600"
                                  />
                                )}
                              </td>
                              <td
                                className={`${td} text-xs font-medium uppercase tracking-wide text-stone-400`}
                              >
                                {ROLE_LABEL[p.role]}
                              </td>
                              <ParticipantEditor
                                contact={{
                                  id: p.contact.id,
                                  name: p.contact.name,
                                  company: p.contact.company,
                                  phone: p.contact.phone,
                                  email: p.contact.email,
                                  notes: p.contact.notes,
                                  extraPhones: readContactPoints(p.contact.extraContacts, "phones"),
                                  extraEmails: readContactPoints(p.contact.extraContacts, "emails"),
                                }}
                                action={updateParticipantContact}
                                back={`/dashboard/transactions/${txn.id}`}
                                transactionId={txn.id}
                                // A buyer or seller is usually a one-off; an
                                // agent, lender or title rep is repeat business
                                // with a record worth opening.
                                simple={p.role === "BUYER" || p.role === "SELLER"}
                                emails={emailsFor(p.contact.id, p.contact.email)}
                              />
                              <td className={td}>
                                <DangerDelete
                                  compact
                                  action={removeParty}
                                  label={`Remove ${p.contact.name}`}
                                  description={`Removes ${p.contact.name} as ${ROLE_LABEL[p.role].toLowerCase()} from this transaction. Their contact record is untouched.`}
                                  hidden={{ id: p.id, transactionId: txn.id }}
                                />
                              </td>
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {txn.parties.some((p) => p.contact.email) && (
                    <button
                      type="submit"
                      form="email-participants-form"
                      className={`${btnGhost} w-fit`}
                    >
                      <Envelope size={14} className="mr-1 inline" aria-hidden />
                      Email selected
                    </button>
                  )}
                </div>
              )}

              {contractParties.length > 0 && (
                <div className="mt-4 border-t border-stone-100 pt-3">
                  <p className="mb-1.5 text-xs font-medium text-stone-500">
                    From the contract — not yet linked to a contact
                  </p>
                  <ul className="flex flex-col divide-y divide-stone-100">
                    {contractParties.map((p) => (
                      <li key={`${p.role}:${p.value}`} className="group py-1.5 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-stone-400">
                            {partyLabel(p.role)}
                          </span>
                          <span className="min-w-0 flex-1 text-stone-600">{p.value}</span>
                          <form action={removeTransactionParty}>
                            <input type="hidden" name="id" value={txn.id} />
                            <input type="hidden" name="role" value={p.role} />
                            <input type="hidden" name="value" value={p.value} />
                            <button
                              type="submit"
                              aria-label={`Dismiss ${p.value}`}
                              title="Dismiss — not a real party"
                              className="text-xs text-stone-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                            >
                              ✕
                            </button>
                          </form>
                        </div>
                        <LinkPartyForm
                          action={linkExtractedParty}
                          transactionId={txn.id}
                          role={p.role}
                          value={p.value}
                          contacts={contactOptions}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          )}
          {tab === "team" && (
            <SectionCard
              title="Team on this file"
              icon={<UserCircle size={15} weight="fill" aria-hidden />}
            >
              <p className="mb-3 text-sm text-stone-500">
                Who in the workspace works this file — not the buyer, seller, or other outside
                contacts (see the Participants tab for those). Filter the transactions list to
                "Assigned to me" to see your own.
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
                          <select
                            name="feeMode"
                            defaultValue={a.feePercentBp != null ? "percent" : "flat"}
                            className={`${input} px-1.5 py-1 text-xs`}
                            title="Flat amount, or a share of this file's fee revenue"
                          >
                            <option value="flat">fee $</option>
                            <option value="percent">% of fee</option>
                          </select>
                          <input
                            name="feeCents"
                            defaultValue={a.feeCents == null ? "" : (a.feeCents / 100).toFixed(2)}
                            placeholder="350.00"
                            className={`${input} w-20 px-2 py-1 text-xs`}
                          />
                          <input
                            name="feePercent"
                            defaultValue={
                              a.feePercentBp == null ? "" : String(a.feePercentBp / 100)
                            }
                            placeholder="70%"
                            className={`${input} w-14 px-2 py-1 text-xs`}
                          />
                          <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                            Save
                          </button>
                        </form>
                      )}
                      {!a.paymentItem && a.feePercentBp != null && (
                        <span className="text-xs text-stone-500">
                          {formatPercentBp(a.feePercentBp)} · earned{" "}
                          {fmtCents(
                            assigneePayout(a, fileMoney.billedCents, fileMoney.paidCents)
                              .earnedCents,
                          )}{" "}
                          · payable{" "}
                          {fmtCents(
                            assigneePayout(a, fileMoney.billedCents, fileMoney.paidCents)
                              .payableCents,
                          )}
                        </span>
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
                        <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
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
            </SectionCard>
          )}
          {tab === "emails" && (
            <>
              <SectionCard
                title="Send an email"
                icon={<PaperPlaneTilt size={15} weight="fill" aria-hidden />}
                tour="txn-emails"
              >
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
                      <div className="mb-3 flex flex-col gap-2">
                        {emailTaskTitle && suggestedTemplates.length > 0 && (
                          <p className="flex flex-wrap items-center gap-2 text-xs">
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
                        <EmailTemplateSelect
                          transactionId={txn.id}
                          emailTask={emailTask}
                          groups={emailTemplateGroups}
                          selected={emailTemplate}
                        />
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
                      <div className="flex flex-col">
                        <div className={composeRow}>
                          <span className={composeLabel}>To</span>
                          <input
                            name="to"
                            required
                            defaultValue={composeTo}
                            list={`party-emails-${txn.id}`}
                            placeholder="name@example.com"
                            className={input}
                          />
                        </div>
                        <datalist id={`party-emails-${txn.id}`}>
                          {txn.parties
                            .filter((p) => p.contact.email)
                            .map((p) => (
                              <option key={p.id} value={p.contact.email ?? ""}>
                                {p.contact.name}
                              </option>
                            ))}
                        </datalist>
                        <div className={composeRow}>
                          <span className={composeLabel}>Cc</span>
                          <input
                            name="cc"
                            defaultValue={composeCc}
                            list={`party-emails-${txn.id}`}
                            placeholder="name@example.com"
                            className={input}
                          />
                        </div>
                        <div className={composeRow}>
                          <span className={composeLabel}>Subject</span>
                          <input
                            name="subject"
                            required
                            defaultValue={composeSubject}
                            className={input}
                          />
                        </div>
                      </div>
                      {selectedEmailTemplate?.composeNote && (
                        <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800">
                          {selectedEmailTemplate.composeNote}
                        </p>
                      )}
                      {selectedEmailTemplate?.filePlaceholders && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedEmailTemplate.filePlaceholders
                            .split(",")
                            .map((f) => f.trim())
                            .filter(Boolean)
                            .map((f) => (
                              <span
                                key={f}
                                className="rounded-full border border-stone-300 bg-stone-50 px-2.5 py-0.5 text-xs text-stone-600"
                              >
                                {f}
                              </span>
                            ))}
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-stone-700">Body</span>
                        <TemplateEditor
                          name="body"
                          defaultValue={composeBody}
                          rows={9}
                          showMergeField={false}
                          transactionId={txn.id}
                          tenantName={emailCtx?.org.name ?? txn.propertyAddress}
                          accent={emailCtx?.emailAccent}
                          tc={ownTcCard}
                          agent={emailCtx?.agentCard}
                          otherSide={emailCtx?.otherCard}
                          signatureOptions={signatureOptions}
                          defaultSignatureId={defaultSignatureId}
                        />
                      </div>
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
                      {canSendAsMe && (
                        <label className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                          <input
                            type="checkbox"
                            name="sendAsSelf"
                            value="1"
                            className="accent-brand-600"
                          />
                          Send from my own address ({myMailbox?.email}) instead of the workspace
                          address
                          <span className="w-full text-stone-400">
                            The reply comes back to your mailbox, and still lands on this file.
                          </span>
                        </label>
                      )}
                      <div className="flex flex-wrap items-end gap-3">
                        <button type="submit" className={btn}>
                          Send email
                        </button>
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
              </SectionCard>

              {scheduledEmails.length > 0 && (
                <SectionCard title="Scheduled" icon={<Clock size={15} weight="fill" aria-hidden />}>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {scheduledEmails.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-3">
                        <span className="font-medium">{e.subject}</span>
                        <span className="text-stone-500">to {e.toAddr}</span>
                        <span className="tabular-nums text-xs text-stone-400">
                          {e.sendAt.toLocaleString()}
                        </span>
                        {e.sendAsUserId && (
                          <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                            from your address
                          </span>
                        )}
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
                </SectionCard>
              )}

              <SectionCard title="Thread" icon={<ChatCircle size={15} weight="fill" aria-hidden />}>
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
                            {/* A message can be booked and then called back
                                without ever going out, so the heading has to
                                carry that — "Sent" over a cancelled row, with
                                the truth demoted to a badge, contradicts
                                itself. Only mail that actually left says Sent. */}
                            {e.direction === "INBOUND"
                              ? "↩ Reply"
                              : e.status === "SCHEDULED"
                                ? "◷ Scheduled"
                                : e.status === "CANCELLED"
                                  ? "⊘ Cancelled"
                                  : "→ Sent"}
                          </span>
                          <span className="text-stone-500">
                            {e.direction === "INBOUND" ? `from ${e.fromAddr}` : `to ${e.toAddr}`}
                          </span>
                          <span className="ml-auto flex items-center gap-2">
                            {/* Whatever the heading already said needs no
                                badge repeating it — what's left is the
                                delivery outcome. */}
                            {e.status !== "SENT" &&
                              e.status !== "RECEIVED" &&
                              e.status !== "SCHEDULED" &&
                              e.status !== "CANCELLED" && (
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
              </SectionCard>
            </>
          )}
          {tab === "notes" && (
            <div className="mb-4">
              <HandbookNotes
                subjectType="TRANSACTION"
                subjectId={txn.id}
                notes={handbookNotes}
                canWrite={hb.notes}
                locked={hb.locked}
                title="Handbook — this file"
                hint="Anything specific to this file that someone picking it up would need told. Notes on the client or the people involved live on their own records, and show up in Worth knowing."
              />
            </div>
          )}
          {tab === "notes" && (
            <SectionCard title="Notes" icon={<NotePencil size={15} weight="fill" aria-hidden />}>
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
                  Details
                </Link>{" "}
                tab.
              </p>
            </SectionCard>
          )}
          {tab === "payout" && canSetFees && (
            <SectionCard title="Invoices" icon={<Receipt size={15} weight="fill" aria-hidden />}>
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
            </SectionCard>
          )}
          {tab === "misc" && (
            <>
              {txn.intakeSubmissions.length > 0 && (
                <SectionCard
                  title="Intake submissions"
                  icon={<Tray size={15} weight="fill" aria-hidden />}
                >
                  <p className="mb-3 text-sm text-stone-500">
                    Submitted by your clients through the portal. Uploaded files are on the
                    Attachments tab, prefixed “Intake —”.
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
                </SectionCard>
              )}
              <SectionCard
                title="Client portal links"
                icon={<LinkIcon size={15} weight="fill" aria-hidden />}
                tour="txn-portals"
              >
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
                                pl.showParties && "participants",
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
                              {!pl.revokedAt && (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-brand-700"
                                >
                                  <ArrowSquareOut size={13} aria-hidden />
                                  Open
                                </a>
                              )}
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
                          {(() => {
                            const sent = sentLinks.get(pl.id);
                            if (!sent) return null;
                            return (
                              <p className="mt-1 text-xs text-stone-400">
                                <Envelope size={11} className="mr-1 inline" aria-hidden />
                                {sent.summary} · {sent.actorName} · {fmtDate(sent.at)}
                              </p>
                            );
                          })()}
                          {!pl.revokedAt && (
                            <>
                              <input
                                readOnly
                                value={url}
                                className="mt-1 w-full rounded border border-stone-200 bg-stone-50 px-2 py-1 font-mono text-xs text-stone-600"
                              />
                              <EmailPortalLinkForm
                                action={emailPortalLink}
                                transactionId={txn.id}
                                portalLinkId={pl.id}
                                url={url}
                                contacts={contactOptions}
                              />
                            </>
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
                    Participants
                  </label>
                  <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      name="showDocuments"
                      className="h-4 w-4 accent-brand-600"
                    />
                    Attachments
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
              </SectionCard>

              {isAdmin && (
                <DangerDelete
                  action={deleteTransaction}
                  label="Delete this transaction"
                  description={`Removes ${txn.propertyAddress} with its tasks, documents, parties, and portal links. This cannot be undone.`}
                  hidden={{ id: txn.id }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
