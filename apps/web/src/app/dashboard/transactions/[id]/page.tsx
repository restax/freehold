import { PartyRole, prisma, TransactionSide, withTenant } from "@freehold/db";
import {
  ArrowSquareOut,
  Buildings,
  CalendarBlank,
  CalendarCheck,
  ChartPieSlice,
  ChatCircle,
  CheckSquare,
  Clock,
  CurrencyDollar,
  Envelope,
  FilePdf,
  Link as LinkIcon,
  ListBullets,
  ListChecks,
  NotePencil,
  PaperPlaneTilt,
  PencilSimple,
  Phone,
  PlusCircle,
  Receipt,
  ShieldCheck,
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
import { CcEmailPill } from "@/components/cc-email-pill";
import {
  ClosingDateCalendar,
  type DateMarker,
  type MarkerKind,
} from "@/components/closing-date-calendar";
import { ColumnPicker } from "@/components/column-picker";
import { DangerDelete } from "@/components/danger-delete";
import { DocumentDropZone } from "@/components/document-drop-zone";
import { EmailPortalLinkForm } from "@/components/email-portal-link-form";
import { EmailTemplateSelect } from "@/components/email-template-select";
import { EntityPicker } from "@/components/entity-picker";
import { ExtractButton } from "@/components/extract-button";
import { HandbookNotes } from "@/components/handbook-notes";
import { HandbookRecap, type RecapGrade } from "@/components/handbook-recap";
import { KeyDateRow } from "@/components/key-date-row";
import { LinkPartyForm } from "@/components/link-party-form";
import { ListingDetailRow } from "@/components/listing-detail-row";
import { SectionCard } from "@/components/section-card";
import { SideBadge } from "@/components/side-badge";
import { SideFields } from "@/components/side-fields";
import { StatusSelect } from "@/components/status-select";
import { TaskTable } from "@/components/task-table";
import { TemplateEditor } from "@/components/template-editor";
import { VendorOrderTab } from "@/components/vendor-order-tab";
import { VisibilityToggles } from "@/components/visibility-toggles";
import { assignUser, unassignUser } from "@/lib/actions/assignees";
import { applyAttachmentTemplate } from "@/lib/actions/attachment-templates";
import {
  attachSlotDocument,
  reviewSlot,
  startRound,
  submitForReview,
} from "@/lib/actions/compliance";
import { createContactByName } from "@/lib/actions/contacts";
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
  addRequiredDocument,
  confirmDateChange,
  deleteTransaction,
  proposeDateChange,
  removeCustomField,
  removeRequiredDocument,
  removeTransactionParty,
  setCustomField,
  setRequiredDocument,
  updateKeyDate,
  updateListingDetail,
  updateTransaction,
  withdrawDateChange,
} from "@/lib/actions/transactions";
import { recentActivity } from "@/lib/activity";
import {
  type ContractParty,
  type ExecutionCheck,
  executionNotice,
  partyLabel,
} from "@/lib/ai/contract-schema";
import { transactionAlert } from "@/lib/alerts";
import {
  displayState,
  type InvoiceDisplayState,
  invoiceMoney,
  LINE_KINDS,
  paidCents,
  transactionBilling,
} from "@/lib/billing";
import { assigneePayout, filePayoutTotals, formatPercentBp } from "@/lib/billing-payouts";
import {
  SLOT_LABEL as COMPLIANCE_SLOT_LABEL,
  STATUS_LABEL as COMPLIANCE_STATUS_LABEL,
  STATUS_TONE as COMPLIANCE_STATUS_TONE,
  effectiveTier,
} from "@/lib/compliance";
import { emailEnabled } from "@/lib/email";
import { parseEmailSettings, renderMerge } from "@/lib/email-template";
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

const TXN_TABS = [
  ["tasks", "Tasks"],
  ["documents", "Attachments"],
  ["vendors", "Vendors"],
  ["billing", "Billing"],
  ["compliance", "Compliance"],
  ["dates", "Dates & details"],
  ["participants", "Participants"],
  ["team", "Team"],
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
    dateTemplate?: string;
    emailTo?: string | string[];
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
    dateTemplate,
    emailTo,
  } = await searchParams;
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
        tx.contact.findMany({ orderBy: { name: "asc" } }),
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
  // (alphabetically), then anything unfiled last.
  const emailTemplateGroupMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const t of emailTemplates) {
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

  // Two things a coordinator needs flagged the moment they open a file: a
  // side with nobody recorded (buyer or seller — real estate contracts always
  // have both), and a contract that isn't actually signed yet, which makes
  // every date and dollar figure on the file provisional.
  const missingSides = (["BUYER", "SELLER"] as const).filter(
    (role) => !txn.parties.some((p) => p.role === role),
  );
  // Ours first, then the third parties, then the other side's people.
  const groupedParties = groupPartiesBySide(txn.parties, txn.side);
  const latestExtraction = txn.extractions[0] ?? null;
  const execNotice = latestExtraction
    ? executionNotice((latestExtraction.execution as ExecutionCheck | null) ?? null)
    : null;
  const showExecNotice = execNotice && execNotice.tone !== "success";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: "Transactions", href: "/dashboard/transactions" },
              { label: txn.propertyAddress },
            ]}
          />
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <SideBadge side={txn.side} labels={labels} size="md" />
            {txn.propertyAddress}
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

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 xl:order-1">
          {/* First in the sidebar, above the dates: this is what someone needs
              to have read *before* they act on the file, and anything further
              down gets scrolled past. Renders nothing when there is nothing
              to say, so it never becomes furniture people learn to ignore. */}
          <HandbookRecap notes={handbookPool} grades={handbookGrades} />
          <SectionCard
            title="Key dates"
            icon={<CalendarBlank size={15} weight="fill" aria-hidden />}
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
            bodyClassName="p-3"
          >
            <ul className="flex flex-col gap-1.5 text-sm">
              {txn.tasks
                .filter((t) => t.status === "OPEN" && t.dueDate)
                .slice(0, 6)
                .map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/dashboard/transactions/${txn.id}?tab=${t.title.startsWith("Follow up:") ? "billing" : "tasks"}`}
                      className="flex justify-between gap-2 hover:text-brand-700"
                      title="This file's own task — opens the tab it lives on"
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
          <nav className="flex flex-wrap gap-1 border-b border-stone-200">
            {TXN_TABS.filter(([key]) => !(!billing.view && key === "billing")).map(
              ([key, labelText]) => (
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
              ),
            )}
          </nav>
          {tab === "tasks" && (
            <SectionCard
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
            <div className="flex flex-col gap-4">
              <DocumentDropZone transactionId={txn.id} linkAction={setRequiredDocument} />
              <SectionCard
                title="Required documents"
                icon={<ListChecks size={15} weight="fill" aria-hidden />}
                count={
                  txn.requiredDocuments.length > 0
                    ? `${txn.requiredDocuments.filter((r) => r.document).length} of ${txn.requiredDocuments.length} received`
                    : undefined
                }
              >
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
                {attachmentTemplates.length > 0 && (
                  <form
                    action={applyAttachmentTemplate}
                    className="mt-3 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3"
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
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className={btnGhost}>
                      Apply
                    </button>
                  </form>
                )}
              </SectionCard>

              <SectionCard
                title="Attachments & contract extraction"
                icon={<FilePdf size={15} weight="fill" aria-hidden />}
                action={
                  txn.proFeaturesEnabled ? (
                    <span className="rounded-full bg-brand-600/10 px-2 py-0.5 text-xs font-medium text-brand-700">
                      Pro AI on
                    </span>
                  ) : null
                }
              >
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
                            <span className="flex flex-wrap items-center gap-2">
                              <ExtractButton
                                action={runExtraction}
                                documentId={doc.id}
                                label={
                                  latestExtractionByDoc.has(doc.id)
                                    ? "Extract again"
                                    : "Extract contract data"
                                }
                              />
                              {/* Already read once. Says so on the row rather
                                  than leaving the button looking like the only
                                  thing that ever happens here — and links
                                  straight to that run, so re-extracting is a
                                  deliberate choice, not the only option. */}
                              {(() => {
                                const latest = latestExtractionByDoc.get(doc.id);
                                if (!latest) return null;
                                return (
                                  <Link
                                    href={`/dashboard/transactions/${txn.id}/extractions/${latest.id}`}
                                    className="inline-flex items-center gap-1.5 text-xs hover:underline"
                                  >
                                    <ExtractionBadge status={latest.status} />
                                    <span className="text-stone-400">
                                      {fmtDate(latest.createdAt)}
                                    </span>
                                  </Link>
                                );
                              })()}
                            </span>
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
                          <span className="min-w-0 truncate font-medium text-stone-700">
                            {ex.document.filename}
                          </span>
                          <span className="shrink-0 text-stone-500">
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
              </SectionCard>
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
                      contacts={contactOptions}
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
                and more. Real contacts, not free text; click a name to open their record.
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
                              <td className={td}>
                                <span className="inline-flex items-center gap-1.5">
                                  <Link
                                    href={`/dashboard/contacts/${p.contact.id}`}
                                    className="font-medium text-brand-700 hover:underline"
                                  >
                                    {p.contact.name}
                                  </Link>
                                  <Link
                                    href={`/dashboard/contacts/${p.contact.id}/edit`}
                                    title="Edit contact details"
                                    aria-label={`Edit ${p.contact.name}`}
                                    className="text-stone-300 transition-colors hover:text-brand-700"
                                  >
                                    <PencilSimple size={12} aria-hidden />
                                  </Link>
                                </span>
                              </td>
                              <td className={td}>
                                {p.contact.company ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Buildings size={13} className="text-stone-400" aria-hidden />
                                    {p.contact.company}
                                  </span>
                                ) : (
                                  <span className="text-stone-300">—</span>
                                )}
                              </td>
                              <td className={td}>
                                {p.contact.phone ? (
                                  <a
                                    href={`tel:${p.contact.phone}`}
                                    className="inline-flex items-center gap-1 hover:underline"
                                  >
                                    <Phone size={13} className="text-stone-400" aria-hidden />
                                    {p.contact.phone}
                                  </a>
                                ) : (
                                  <span className="text-stone-300">—</span>
                                )}
                              </td>
                              <td className={td}>
                                {p.contact.email ? (
                                  <Link
                                    href={`/dashboard/transactions/${txn.id}?tab=emails&emailTo=${encodeURIComponent(p.contact.email)}`}
                                    className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                                  >
                                    <Envelope size={13} aria-hidden />
                                    {p.contact.email}
                                  </Link>
                                ) : (
                                  <span className="text-stone-300">—</span>
                                )}
                              </td>
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
                  Dates &amp; details
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
