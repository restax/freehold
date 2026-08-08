import { withTenant } from "@freehold/db";
import {
  CalendarBlank,
  ChatText,
  FileText,
  Paperclip,
  PhoneCall,
  UploadSimple,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddressPill } from "@/components/address-pill";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SectionCard } from "@/components/section-card";
import { TaskNotesField } from "@/components/task-notes-field";
import { TaskPrioritySelect } from "@/components/task-priority-select";
import { TaskStatusSelect } from "@/components/task-status-select";
import { VisibilityToggles } from "@/components/visibility-toggles";
import {
  addTaskNote,
  generateTaskDocument,
  logTaskCall,
  uploadTaskDocument,
} from "@/lib/actions/task-work";
import { setTaskDueDate, setTaskNotes, setTaskPriority, setTaskStatus } from "@/lib/actions/tasks";
import { fmtDate, fmtDayMonth } from "@/lib/format";
import { priorityBadgeStyle } from "@/lib/priority";
import { guestMaySeeTransaction, requireTenant } from "@/lib/tenant";
import { btn, btnGhost, card, input, label } from "@/lib/ui";

export const dynamic = "force-dynamic";

/**
 * One task, with everything needed to actually do it.
 *
 * The checklist on the transaction answers "what's left"; this answers "get it
 * done". Writing the letter, making the call, filing what came back, and
 * recording what happened all live here, so working a task doesn't mean
 * bouncing between four tabs and remembering to come back and tick it off.
 *
 * Sending email is the one job that stays on the Emails tab: the compose form
 * there carries signatures, attachments, scheduling and send-as-me, and a
 * second copy of it would be a second thing to keep correct. The button hands
 * over with this task preselected.
 */

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  OPEN: { label: "Open", tone: "bg-stone-100 text-stone-700" },
  DONE: { label: "Done", tone: "bg-emerald-50 text-emerald-800" },
  HOLD: { label: "On hold", tone: "bg-amber-50 text-amber-800" },
  SKIPPED: { label: "Not needed", tone: "bg-stone-100 text-stone-500" },
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { tenantId, session } = await requireTenant({ allowGuest: true });
  const { id, taskId } = await params;
  // A guest reaches only the files they were handed; anything else doesn't
  // exist as far as they're concerned.
  if (!(await guestMaySeeTransaction(tenantId, session.user.id, id))) notFound();

  const data = await withTenant(tenantId, async (tx) => {
    const task = await tx.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        documents: { orderBy: { createdAt: "desc" } },
        activity: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!task || task.transactionId !== id) return null;
    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { id: true, propertyAddress: true, closeDate: true, contractDate: true },
    });
    const docTemplates = await tx.docTemplate.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return { task, txn, docTemplates };
  });
  if (!data) notFound();
  const { task, txn, docTemplates } = data;

  const today = fmtDate(new Date());
  const dueStr = task.dueDate ? fmtDate(task.dueDate) : "";
  const overdue = task.status === "OPEN" && dueStr !== "" && dueStr < today;
  const status = STATUS_COPY[task.status] ?? STATUS_COPY.OPEN;
  const tint = priorityBadgeStyle(task.priority)?.backgroundColor as string | undefined;
  const phone = task.contact?.phone ?? "";

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Transactions", href: "/dashboard/transactions" },
          { label: txn.propertyAddress, href: `/dashboard/transactions/${txn.id}?tab=tasks` },
          { label: task.title },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="font-serif text-2xl font-semibold leading-tight"
            style={tint ? { backgroundColor: tint } : undefined}
          >
            {task.title}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${status.tone}`}>
              {status.label}
            </span>
            <span className={overdue ? "font-medium text-red-700" : ""}>
              {task.dueDate ? `Due ${fmtDayMonth(task.dueDate)}` : "No due date"}
              {overdue ? " — overdue" : ""}
            </span>
            <AddressPill href={`/dashboard/transactions/${txn.id}?tab=tasks`}>
              {txn.propertyAddress}
            </AddressPill>
          </p>
        </div>
        {/* Marking it done is the whole point of the screen; it stays where the
            eye lands rather than buried in the details card. */}
        <form action={setTaskStatus} className="shrink-0">
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="transactionId" value={txn.id} />
          <input type="hidden" name="status" value={task.status === "DONE" ? "OPEN" : "DONE"} />
          <button type="submit" className={btn}>
            {task.status === "DONE" ? "Reopen task" : "Mark complete"}
          </button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <SectionCard
            title="Do the work"
            icon={<ChatText size={15} weight="fill" aria-hidden />}
            tooltip="Everything this task might need: a letter, an email, a call, or a file."
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-2">
                {docTemplates.length > 0 && (
                  <form action={generateTaskDocument} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="transactionId" value={txn.id} />
                    <label className={label}>
                      Write a document
                      <select name="templateId" className={input} defaultValue="">
                        <option value="" disabled>
                          Pick a template…
                        </option>
                        {docTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className={btnGhost}>
                      <FileText size={14} className="mr-1 inline" aria-hidden />
                      Generate
                    </button>
                  </form>
                )}

                <Link
                  href={`/dashboard/transactions/${txn.id}?tab=emails&emailTask=${task.id}${
                    task.emailTemplateId ? `&emailTemplate=${task.emailTemplateId}` : ""
                  }`}
                  className={btnGhost}
                  title={
                    task.emailTemplateId
                      ? "Compose this task's email — its template is ready"
                      : "Compose an email about this task"
                  }
                >
                  ✉ Send an email
                </Link>
              </div>

              <form action={uploadTaskDocument} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="transactionId" value={txn.id} />
                <label className={label}>
                  Upload a file for this task
                  <input type="file" name="file" multiple className={input} />
                </label>
                <button type="submit" className={btnGhost}>
                  <UploadSimple size={14} className="mr-1 inline" aria-hidden />
                  Upload
                </button>
              </form>

              {/* Freehold doesn't dial — a tel: link is what actually works
                  across a desk phone, a mobile and a softphone. What matters
                  is the record afterwards. */}
              <form action={logTaskCall} className="border-t border-stone-100 pt-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700">
                  <PhoneCall size={15} weight="fill" aria-hidden />
                  Log a call
                  {phone && (
                    <a
                      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                      className="font-normal text-brand-700 hover:underline"
                    >
                      Call {task.contact?.name} ({phone})
                    </a>
                  )}
                </p>
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="transactionId" value={txn.id} />
                <div className="flex flex-wrap items-end gap-2">
                  <label className={`${label} min-w-40 flex-1`}>
                    Who
                    <input
                      name="who"
                      defaultValue={task.contact?.name ?? ""}
                      placeholder="Escrow officer"
                      className={input}
                    />
                  </label>
                  <label className={label}>
                    Outcome
                    <select name="outcome" className={input} defaultValue="Spoke">
                      <option>Spoke</option>
                      <option>Left voicemail</option>
                      <option>No answer</option>
                      <option>They called me</option>
                    </select>
                  </label>
                  <label className={`${label} min-w-56 flex-[2]`}>
                    What was said
                    <input
                      name="note"
                      placeholder="Confirmed the appraisal is ordered for Thursday"
                      className={input}
                    />
                  </label>
                  <button type="submit" className={btnGhost}>
                    Log call
                  </button>
                </div>
              </form>
            </div>
          </SectionCard>

          <SectionCard
            title="Files for this task"
            icon={<Paperclip size={15} weight="fill" aria-hidden />}
            count={task.documents.length}
          >
            {task.documents.length === 0 ? (
              <p className="text-sm text-stone-400">
                Nothing filed yet. Anything you write or upload here shows up on the file's
                Attachments tab too.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {task.documents.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-2 text-sm">
                    <a
                      href={`/api/documents/${d.id}`}
                      className="min-w-0 truncate text-brand-700 hover:underline"
                    >
                      {d.filename}
                    </a>
                    <span className="shrink-0 text-xs tabular-nums text-stone-400">
                      {fmtDayMonth(d.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Work log"
            icon={<ChatText size={15} weight="fill" aria-hidden />}
            count={task.activity.length}
            tooltip="Calls, notes and files recorded against this task. Also appears in the file's activity."
          >
            <form action={addTaskNote} className="mb-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="transactionId" value={txn.id} />
              <label className={`${label} min-w-56 flex-1`}>
                Add a note
                <input
                  name="note"
                  placeholder="Lender says the file is with underwriting"
                  className={input}
                />
              </label>
              <button type="submit" className={btnGhost}>
                Add
              </button>
            </form>
            {task.activity.length === 0 ? (
              <p className="text-sm text-stone-400">Nothing recorded on this task yet.</p>
            ) : (
              <ul className="flex flex-col gap-2 border-t border-stone-100 pt-3">
                {task.activity.map((a) => (
                  <li key={a.id} className="text-sm">
                    <p className="text-stone-700">{a.summary}</p>
                    <p className="text-xs text-stone-400">
                      {a.actorName} · {fmtDayMonth(a.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="flex flex-col gap-4">
          <SectionCard title="Details" icon={<CalendarBlank size={15} weight="fill" aria-hidden />}>
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
                  Due date
                </p>
                {/* A plain field edit, deliberately not the amendment flow —
                    a checklist item's date isn't contract-governed. */}
                <form action={setTaskDueDate} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="transactionId" value={txn.id} />
                  <input type="date" name="value" defaultValue={dueStr} className={input} />
                  <button type="submit" className={btnGhost}>
                    Save
                  </button>
                </form>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
                  Status
                </p>
                <TaskStatusSelect
                  action={setTaskStatus}
                  id={task.id}
                  transactionId={txn.id}
                  status={task.status}
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
                  Priority
                </p>
                <TaskPrioritySelect
                  action={setTaskPriority}
                  id={task.id}
                  transactionId={txn.id}
                  priority={task.priority}
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
                  Shared with
                </p>
                <VisibilityToggles
                  kind="task"
                  id={task.id}
                  transactionId={txn.id}
                  visibleToAgent={task.visibleToAgent}
                  visibleToClient={task.visibleToClient}
                />
              </div>

              <div className="border-t border-stone-100 pt-3">
                <p className="text-xs text-stone-500">
                  Assigned to{" "}
                  <span className="text-stone-700">{task.assignee?.name ?? "nobody yet"}</span>
                </p>
                {task.contact && (
                  <p className="mt-1 text-xs text-stone-500">
                    Contact{" "}
                    <Link
                      href={`/dashboard/contacts/${task.contact.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {task.contact.name}
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* The task's own notes: what to know about it, as against the work
              log's record of what happened. */}
          <SectionCard title="Notes" tooltip="What someone picking this up needs to know.">
            <TaskNotesField
              action={setTaskNotes}
              id={task.id}
              transactionId={txn.id}
              notes={task.notes}
            />
          </SectionCard>

          <div className={card}>
            <p className="text-xs text-stone-500">
              Not needed on this file? Set the status to <strong>Not needed</strong> above. It stays
              on the checklist, greyed out, so the next person knows it was decided rather than
              missed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
