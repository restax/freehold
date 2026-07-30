"use client";

import { AssigneeRole, DateAnchor, TaskKind, TaskPriority, TransactionSide } from "@freehold/db";
import { ArrowCounterClockwise, CaretRight, Plus, TrashSimple } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { ActionPlanTaskSummary } from "@/components/action-plan-task-row";
import {
  addTemplateTask,
  deleteTemplateTasks,
  updateTemplateTask,
} from "@/lib/actions/action-plans";
import { ANCHOR_LABEL } from "@/lib/task-template-labels";

const PRIORITY_OPTIONS = [
  { value: TaskPriority.NORMAL, label: "Normal" },
  { value: TaskPriority.HIGH, label: "High" },
  { value: TaskPriority.CRITICAL, label: "Critical" },
];

const KIND_OPTIONS = [
  { value: TaskKind.TODO, label: "To-do" },
  { value: TaskKind.EMAIL, label: "Email" },
  { value: TaskKind.CALL, label: "Call" },
];

const ROLE_OPTIONS = [
  { value: AssigneeRole.TC1, label: "TC 1" },
  { value: AssigneeRole.TC2, label: "TC 2" },
  { value: AssigneeRole.AGENT, label: "Agent" },
];

const SIDE_OPTIONS = [
  { value: TransactionSide.BUY_SIDE, label: "Buy side" },
  { value: TransactionSide.SELL_SIDE, label: "Sell side" },
  { value: TransactionSide.DUAL, label: "Dual" },
];

const fieldInput =
  "w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm focus:border-brand-600 focus:outline-none";
const fieldLabel = "flex flex-col gap-1 text-xs font-medium text-stone-600";
const checkLabel = "flex items-center gap-1.5 text-xs text-stone-600";
const actionBtn =
  "flex h-7 w-7 items-center justify-center rounded-md text-stone-300 transition-colors hover:bg-stone-100 hover:text-stone-600";

export type ActionPlanTaskRow = {
  id: string;
  sortOrder: number;
  title: string;
  notes: string | null;
  kind: string;
  anchor: string;
  offsetDays: number;
  dependsOnId: string | null;
  sides: string[];
  assigneeRole: string | null;
  milestone: boolean;
  onCalendar: boolean;
  visibleToAgent: boolean;
  visibleToClient: boolean;
  reminderDays: number | null;
  priority: string;
  emailTemplateId: string | null;
  autoSendEmail: boolean;
  attachmentTemplateId: string | null;
  dateTemplateId: string | null;
  docTemplateId: string | null;
};

export type NamedTemplate = { id: string; name: string };

/** Everything the editor reads, as one string — a change here means its
 *  uncontrolled defaults are stale and the form has to remount. */
function entrySignature(t: ActionPlanTaskRow): string {
  return JSON.stringify(t);
}

/**
 * A plan's task templates: one row each, expanding into the full editor.
 *
 * This used to be a spreadsheet grid, which stopped working once an entry
 * grew past a handful of settings — nineteen columns don't fit on a screen,
 * and most rows leave most of them empty. A row now shows what it does and
 * hides the rest behind a click.
 *
 * Deleting a row only stages it locally (moved to a restorable "pending
 * deletion" list); nothing hits the server until the batch is explicitly
 * committed with a typed confirmation.
 */
export function ActionPlanTaskGrid({
  planId,
  tasks,
  emailTemplates,
  attachmentTemplates,
  dateTemplates,
  docTemplates,
}: {
  planId: string;
  tasks: ActionPlanTaskRow[];
  emailTemplates: NamedTemplate[];
  attachmentTemplates: NamedTemplate[];
  dateTemplates: NamedTemplate[];
  docTemplates: NamedTemplate[];
}) {
  const [trashedIds, setTrashedIds] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // A commit (or any unrelated revalidation, e.g. another row's save) hands
  // back a fresh `tasks` prop. Once a trashed id is genuinely gone from it,
  // stop tracking it locally instead of showing a ghost trash entry.
  useEffect(() => {
    setTrashedIds((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(tasks.map((t) => t.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tasks]);

  // Nothing is destroyed by staging a delete, so this is a courtesy: warn
  // before a real page unload (refresh/close/typed URL) drops the staging.
  useEffect(() => {
    if (trashedIds.size === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [trashedIds.size]);

  // Same courtesy for in-app navigation (sidebar, back link), which never
  // triggers beforeunload since Next.js intercepts it client-side.
  useEffect(() => {
    if (trashedIds.size === 0) return;
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a[href]");
      const href = link?.getAttribute("href");
      if (!href?.startsWith("/")) return;
      const count = trashedIds.size;
      const ok = window.confirm(
        `${count} task${count === 1 ? "" : "s"} pending deletion ${count === 1 ? "hasn't" : "haven't"} been committed. Leave this page? Nothing will be deleted — the pending removal will just be dropped.`,
      );
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [trashedIds.size]);

  const activeTasks = tasks.filter((t) => !trashedIds.has(t.id));
  const trashedTasks = tasks.filter((t) => trashedIds.has(t.id));
  const titleById = new Map(tasks.map((t) => [t.id, t.title]));
  const emailNameById = new Map(emailTemplates.map((t) => [t.id, t.name.replace(" (Sample)", "")]));

  function moveToTrash(id: string) {
    setTrashedIds((prev) => new Set(prev).add(id));
    if (openId === id) setOpenId(null);
  }
  function restore(id: string) {
    setTrashedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-stone-100 rounded-xl border border-stone-200/70">
        {activeTasks.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-stone-400">
            No tasks in this template yet.
          </li>
        )}
        {activeTasks.map((t) => {
          const open = openId === t.id;
          const attached = [t.attachmentTemplateId, t.dateTemplateId, t.docTemplateId].filter(
            Boolean,
          ).length;
          return (
            <li key={t.id}>
              <div className="flex items-center gap-1 px-2 py-1.5 hover:bg-stone-50">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : t.id)}
                  aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <CaretRight
                    size={12}
                    weight="bold"
                    className={`shrink-0 text-stone-300 transition-transform ${open ? "rotate-90" : ""}`}
                  />
                  <ActionPlanTaskSummary
                    task={t}
                    dependsOnTitle={t.dependsOnId ? (titleById.get(t.dependsOnId) ?? null) : null}
                    emailTemplateName={
                      t.emailTemplateId ? (emailNameById.get(t.emailTemplateId) ?? null) : null
                    }
                    attachedCount={attached}
                  />
                </button>
                <button
                  type="button"
                  title="Move to trash"
                  onClick={() => moveToTrash(t.id)}
                  className={`${actionBtn} shrink-0 hover:bg-red-50 hover:text-red-600`}
                >
                  <TrashSimple size={14} />
                </button>
              </div>
              {open && (
                <div className="border-t border-stone-100 bg-stone-50/60 px-3 py-3">
                  <TaskEntryForm
                    // Remount whenever the saved entry changes. React resets a
                    // form after its action completes, and a reset restores
                    // each control to the default it had *when it mounted* —
                    // for a <select> that's whatever was selected at mount,
                    // which React never re-syncs from a changed defaultValue.
                    // Without this the panel sits there showing the previous
                    // values after a save, and saving again writes them back.
                    key={entrySignature(t)}
                    action={updateTemplateTask}
                    planId={planId}
                    task={t}
                    siblings={activeTasks.filter((s) => s.id !== t.id)}
                    emailTemplates={emailTemplates}
                    attachmentTemplates={attachmentTemplates}
                    dateTemplates={dateTemplates}
                    docTemplates={docTemplates}
                    submitLabel="Save task"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 px-3 py-3">
          <TaskEntryForm
            // Same remount, for the same reason: after an add lands, this
            // form should be genuinely blank rather than half-reset.
            key={`add-${tasks.length}`}
            action={addTemplateTask}
            planId={planId}
            task={null}
            siblings={activeTasks}
            emailTemplates={emailTemplates}
            attachmentTemplates={attachmentTemplates}
            dateTemplates={dateTemplates}
            docTemplates={docTemplates}
            submitLabel="Add task"
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 self-start rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:border-brand-600 hover:text-brand-700"
        >
          <Plus size={14} weight="bold" /> Add a task
        </button>
      )}

      {trashedTasks.length > 0 && (
        <div className="rounded-xl border border-red-200/70 bg-red-50/40 p-4">
          <p className="mb-2 text-sm font-medium text-red-800">
            {trashedTasks.length} task{trashedTasks.length === 1 ? "" : "s"} pending deletion
          </p>
          <ul className="mb-3 flex flex-col gap-1">
            {trashedTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-red-900 line-through decoration-red-400">{t.title}</span>
                <button
                  type="button"
                  onClick={() => restore(t.id)}
                  className="flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900"
                >
                  <ArrowCounterClockwise size={12} />
                  Restore
                </button>
              </li>
            ))}
          </ul>
          <form action={deleteTemplateTasks} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="actionPlanId" value={planId} />
            {trashedTasks.map((t) => (
              <input key={t.id} type="hidden" name="ids" value={t.id} />
            ))}
            <p className="w-full text-xs text-red-700">
              This permanently deletes the task{trashedTasks.length === 1 ? "" : "s"} above.
              Anything waiting on {trashedTasks.length === 1 ? "it" : "them"} goes back to having no
              date rule. Type DELETE to confirm.
            </p>
            <input
              name="confirm"
              required
              placeholder="Type DELETE"
              autoComplete="off"
              className="w-32 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Commit deletion
            </button>
          </form>
        </div>
      )}

      <p className="text-xs text-stone-400">
        Click a task to edit it. Negative offsets fall before the anchor: “Close date, −1” is the
        day before closing. A task set to wait on another has no date until that one is completed.
      </p>
    </div>
  );
}

/** The full editor for one entry — shared by the add form and each row. */
function TaskEntryForm({
  action,
  planId,
  task,
  siblings,
  emailTemplates,
  attachmentTemplates,
  dateTemplates,
  docTemplates,
  submitLabel,
  onCancel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  planId: string;
  task: ActionPlanTaskRow | null;
  siblings: ActionPlanTaskRow[];
  emailTemplates: NamedTemplate[];
  attachmentTemplates: NamedTemplate[];
  dateTemplates: NamedTemplate[];
  docTemplates: NamedTemplate[];
  submitLabel: string;
  onCancel?: () => void;
}) {
  // The anchor drives which of the two dating controls makes sense, so it's
  // the one field held in state — everything else is uncontrolled.
  const [anchor, setAnchor] = useState(task?.anchor ?? DateAnchor.CLOSE_DATE);
  const dependency = anchor === DateAnchor.DEPENDENCY;

  // React resets a form once its action resolves, which wipes this select
  // back to its first option. Normally the remount (see the `key` on this
  // component) hides that, but a save that changed nothing produces no new
  // signature and so no remount — and React won't repaint a value it still
  // believes is correct. So put it back by hand after every render.
  const anchorRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (anchorRef.current && anchorRef.current.value !== anchor) {
      anchorRef.current.value = anchor;
    }
  });

  return (
    <form action={action} className="flex flex-col gap-3">
      {task && <input type="hidden" name="id" value={task.id} />}
      <input type="hidden" name="actionPlanId" value={planId} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={`${fieldLabel} sm:col-span-2`}>
          Task
          <input
            name="title"
            required
            defaultValue={task?.title ?? ""}
            placeholder="Order title work"
            className={fieldInput}
          />
        </label>
        <label className={fieldLabel}>
          Kind
          <select name="kind" defaultValue={task?.kind ?? TaskKind.TODO} className={fieldInput}>
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Assign to
          <select
            name="assigneeRole"
            defaultValue={task?.assigneeRole ?? ""}
            className={fieldInput}
          >
            <option value="">Whoever applies the plan</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldLabel}>
          Dated from
          <select
            ref={anchorRef}
            name="anchor"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            className={fieldInput}
          >
            {Object.values(DateAnchor).map((a) => (
              <option key={a} value={a}>
                {ANCHOR_LABEL[a] ?? a}
              </option>
            ))}
          </select>
        </label>
        {dependency && (
          <label className={fieldLabel}>
            Waits on
            <select
              name="dependsOnId"
              defaultValue={task?.dependsOnId ?? ""}
              className={fieldInput}
            >
              <option value="">Choose a task…</option>
              {siblings.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={fieldLabel}>
          Offset (days)
          <input
            name="offsetDays"
            type="number"
            defaultValue={task?.offsetDays ?? 0}
            className={fieldInput}
          />
        </label>
        <label className={fieldLabel}>
          Remind (days before)
          <input
            name="reminderDays"
            type="number"
            min={0}
            placeholder="No reminder"
            defaultValue={task?.reminderDays ?? ""}
            className={fieldInput}
          />
        </label>
        <label className={fieldLabel}>
          Priority
          <select
            name="priority"
            defaultValue={task?.priority ?? TaskPriority.NORMAL}
            className={fieldInput}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldLabel}>
          Email template
          <select
            name="emailTemplateId"
            defaultValue={task?.emailTemplateId ?? ""}
            className={fieldInput}
          >
            <option value="">None</option>
            {emailTemplates.map((et) => (
              <option key={et.id} value={et.id}>
                {et.name.replace(" (Sample)", "")}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Attachment template
          <select
            name="attachmentTemplateId"
            defaultValue={task?.attachmentTemplateId ?? ""}
            className={fieldInput}
          >
            <option value="">None</option>
            {attachmentTemplates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Key-dates template
          <select
            name="dateTemplateId"
            defaultValue={task?.dateTemplateId ?? ""}
            className={fieldInput}
          >
            <option value="">None</option>
            {dateTemplates.map((dt) => (
              <option key={dt.id} value={dt.id}>
                {dt.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Doc template
          <select
            name="docTemplateId"
            defaultValue={task?.docTemplateId ?? ""}
            className={fieldInput}
          >
            <option value="">None</option>
            {docTemplates.map((dt) => (
              <option key={dt.id} value={dt.id}>
                {dt.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={fieldLabel}>
        Notes (carried onto the task)
        <textarea
          name="notes"
          rows={2}
          defaultValue={task?.notes ?? ""}
          placeholder="What “done” looks like, or anything the coordinator needs on hand."
          className={fieldInput}
        />
      </label>

      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend className="sr-only">Applies to</legend>
        <span className="text-xs font-medium text-stone-600">
          Applies to
          <span className="ml-1 font-normal text-stone-400">(none ticked = every side)</span>
        </span>
        {SIDE_OPTIONS.map((s) => (
          <label key={s.value} className={checkLabel}>
            <input
              type="checkbox"
              name="sides"
              value={s.value}
              defaultChecked={task?.sides.includes(s.value) ?? false}
              className="accent-brand-600"
            />
            {s.label}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className={checkLabel}>
          <input
            type="checkbox"
            name="milestone"
            defaultChecked={task?.milestone ?? false}
            className="accent-brand-600"
          />
          Milestone
        </label>
        <label className={checkLabel}>
          <input
            type="checkbox"
            name="onCalendar"
            defaultChecked={task?.onCalendar ?? true}
            className="accent-brand-600"
          />
          Show on calendar
        </label>
        <label className={checkLabel}>
          <input
            type="checkbox"
            name="visibleToAgent"
            defaultChecked={task?.visibleToAgent ?? true}
            className="accent-brand-600"
          />
          Agent portal
        </label>
        <label className={checkLabel}>
          <input
            type="checkbox"
            name="visibleToClient"
            defaultChecked={task?.visibleToClient ?? true}
            className="accent-brand-600"
          />
          Client portal
        </label>
        <label className={checkLabel}>
          <input
            type="checkbox"
            name="autoSendEmail"
            defaultChecked={task?.autoSendEmail ?? false}
            className="accent-brand-600"
          />
          Send the email automatically on completion
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-800"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            Cancel
          </button>
        )}
        {dependency && (
          <span className="text-xs text-stone-500">
            Dated when the task it waits on is completed, not when the plan is applied.
          </span>
        )}
      </div>
    </form>
  );
}
