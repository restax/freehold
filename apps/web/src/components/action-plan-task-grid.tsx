"use client";

import { DateAnchor, TaskPriority } from "@freehold/db";
import { ArrowCounterClockwise, Check, Plus, TrashSimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import {
  addTemplateTask,
  deleteTemplateTasks,
  updateTemplateTask,
} from "@/lib/actions/action-plans";

const ANCHOR_LABEL: Record<string, string> = {
  CONTRACT_DATE: "Contract date",
  CLOSE_DATE: "Close date",
};

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: TaskPriority.NORMAL, label: "Normal" },
  { value: TaskPriority.HIGH, label: "High" },
  { value: TaskPriority.CRITICAL, label: "Critical" },
];

const GRID_COLS = "2rem minmax(11rem,1fr) 9rem 5rem 6rem 7rem 11rem 4.5rem 4.5rem";

const th =
  "border-b border-stone-200 px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500";
const cellInput =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm shadow-none transition-colors hover:border-stone-300 focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-600/20";
const cellWrap = "flex items-center border-b border-stone-100";
const actionBtn =
  "flex h-7 w-7 items-center justify-center rounded-md text-stone-300 transition-colors hover:bg-stone-100 hover:text-stone-600";

export type ActionPlanTaskRow = {
  id: string;
  sortOrder: number;
  title: string;
  anchor: string;
  offsetDays: number;
  reminderDays: number | null;
  priority: string;
  emailTemplateId: string | null;
  autoSendEmail: boolean;
};

/**
 * Editable task grid for an action plan. Deleting a row only stages it
 * locally (moved to a "pending deletion" list, restorable); nothing hits
 * the server until the batch is explicitly committed with a typed
 * confirmation. This is the pattern to reuse for future delete buttons.
 */
export function ActionPlanTaskGrid({
  planId,
  tasks,
  emailTemplates,
}: {
  planId: string;
  tasks: ActionPlanTaskRow[];
  emailTemplates: { id: string; name: string }[];
}) {
  const [trashedIds, setTrashedIds] = useState<Set<string>>(new Set());

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

  function moveToTrash(id: string) {
    setTrashedIds((prev) => new Set(prev).add(id));
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
      <div className="overflow-x-auto">
        <div className="grid min-w-[880px]" style={{ gridTemplateColumns: GRID_COLS }}>
          <div className={th}>#</div>
          <div className={th}>Task</div>
          <div className={th}>Anchor</div>
          <div className={`${th} text-center`}>Offset</div>
          <div className={`${th} text-center`}>Remind</div>
          <div className={th}>Priority</div>
          <div className={th}>Email template</div>
          <div className={`${th} text-center`}>Auto-send</div>
          <div className={th} />

          {activeTasks.map((t) => (
            <form key={t.id} action={updateTemplateTask} className="contents">
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="actionPlanId" value={planId} />
              <div
                className={`${cellWrap} justify-center px-2 text-xs text-stone-400 tabular-nums`}
              >
                {t.sortOrder}
              </div>
              <div className={cellWrap}>
                <input name="title" required defaultValue={t.title} className={cellInput} />
              </div>
              <div className={cellWrap}>
                <select name="anchor" defaultValue={t.anchor} className={cellInput}>
                  {Object.values(DateAnchor).map((a) => (
                    <option key={a} value={a}>
                      {ANCHOR_LABEL[a]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={cellWrap}>
                <input
                  name="offsetDays"
                  type="number"
                  defaultValue={t.offsetDays}
                  className={`${cellInput} text-center`}
                />
              </div>
              <div className={cellWrap}>
                <input
                  name="reminderDays"
                  type="number"
                  min={0}
                  placeholder="—"
                  defaultValue={t.reminderDays ?? ""}
                  className={`${cellInput} text-center`}
                />
              </div>
              <div className={cellWrap}>
                <select name="priority" defaultValue={t.priority} className={cellInput}>
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={cellWrap}>
                <select
                  name="emailTemplateId"
                  defaultValue={t.emailTemplateId ?? ""}
                  className={cellInput}
                >
                  <option value="">None</option>
                  {emailTemplates.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.name.replace(" (Sample)", "")}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`${cellWrap} justify-center`}>
                <input
                  type="checkbox"
                  name="autoSendEmail"
                  defaultChecked={t.autoSendEmail}
                  className="accent-brand-600"
                />
              </div>
              <div className={`${cellWrap} justify-end gap-0.5 pr-1`}>
                <button type="submit" title="Save changes" className={actionBtn}>
                  <Check size={14} weight="bold" />
                </button>
                <button
                  type="button"
                  title="Move to trash"
                  onClick={() => moveToTrash(t.id)}
                  className={`${actionBtn} hover:bg-red-50 hover:text-red-600`}
                >
                  <TrashSimple size={14} />
                </button>
              </div>
            </form>
          ))}

          <form action={addTemplateTask} className="contents">
            <input type="hidden" name="actionPlanId" value={planId} />
            <div className={cellWrap} />
            <div className={cellWrap}>
              <input name="title" required placeholder="Add a task…" className={cellInput} />
            </div>
            <div className={cellWrap}>
              <select name="anchor" defaultValue={DateAnchor.CLOSE_DATE} className={cellInput}>
                {Object.values(DateAnchor).map((a) => (
                  <option key={a} value={a}>
                    {ANCHOR_LABEL[a]}
                  </option>
                ))}
              </select>
            </div>
            <div className={cellWrap}>
              <input
                name="offsetDays"
                type="number"
                defaultValue={0}
                className={`${cellInput} text-center`}
              />
            </div>
            <div className={cellWrap}>
              <input
                name="reminderDays"
                type="number"
                min={0}
                placeholder="—"
                className={`${cellInput} text-center`}
              />
            </div>
            <div className={cellWrap}>
              <select name="priority" defaultValue={TaskPriority.NORMAL} className={cellInput}>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={cellWrap}>
              <select name="emailTemplateId" defaultValue="" className={cellInput}>
                <option value="">None</option>
                {emailTemplates.map((et) => (
                  <option key={et.id} value={et.id}>
                    {et.name.replace(" (Sample)", "")}
                  </option>
                ))}
              </select>
            </div>
            <div className={`${cellWrap} justify-center`}>
              <input type="checkbox" name="autoSendEmail" className="accent-brand-600" />
            </div>
            <div className={`${cellWrap} justify-end pr-1`}>
              <button type="submit" title="Add task" className={actionBtn}>
                <Plus size={14} weight="bold" />
              </button>
            </div>
          </form>
        </div>
      </div>

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
              This permanently deletes the task{trashedTasks.length === 1 ? "" : "s"} above. Type
              DELETE to confirm.
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
        Negative offsets fall before the anchor: “Close date, −1” is the day before closing. Tasks
        with an email template open compose with that email ready. Click any cell to edit, then save
        the row. Deleting moves a task to the list below — nothing is removed until you commit.
      </p>
    </div>
  );
}
