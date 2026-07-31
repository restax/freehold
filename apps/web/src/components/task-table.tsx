import type { ReactNode } from "react";
import { DangerDelete } from "@/components/danger-delete";
import { TaskNotesField } from "@/components/task-notes-field";
import { TaskStatusSelect } from "@/components/task-status-select";
import { VisibilityToggles } from "@/components/visibility-toggles";
import { fmtDate, fmtDayMonth } from "@/lib/format";
import { PRIORITY_LABEL, priorityBadgeStyle, priorityColorStyle } from "@/lib/priority";
import type { ColumnDef } from "@/lib/task-columns";
import { taskTableMinWidth } from "@/lib/task-columns";
import { tableWrap, td, th, trHover } from "@/lib/ui";

/**
 * The task checklist on a transaction, as a strict table with pickable
 * columns.
 *
 * The controls at either end are deliberately *not* columns — see
 * lib/task-columns.ts. The done-checkbox leads every row and the act-on-it
 * cluster (email, priority flag, portal visibility, delete) trails it,
 * whatever the picker is set to: hiding the checkbox would leave a checklist
 * nothing can be ticked off in.
 *
 * Split out of the transaction page, which is already ~2,900 lines.
 */

export interface TaskRow {
  id: string;
  title: string;
  notes: string | null;
  dueDate: Date | null;
  status: string;
  priority: string;
  anchor: string | null;
  offsetDays: number | null;
  completedAt: Date | null;
  createdAt: Date;
  emailTemplateId: string | null;
  visibleToAgent: boolean;
  visibleToClient: boolean;
  assignee: { id: string; name: string | null } | null;
  contact: { id: string; name: string } | null;
}

/** Which audiences a task is shared with, in the order they're toggled. */
function sharedWith(t: TaskRow): string {
  const who = [t.visibleToAgent && "agent", t.visibleToClient && "client"].filter(Boolean);
  return who.length > 0 ? who.join(", ") : "internal only";
}

/** Where a task came from: a plan anchor, or typed in by hand. */
function source(t: TaskRow): string {
  if (!t.anchor) return "Added by hand";
  const days = t.offsetDays ?? 0;
  const anchor = t.anchor === "CLOSE_DATE" ? "close" : "contract";
  if (days === 0) return `On ${anchor}`;
  return days > 0 ? `${days}d after ${anchor}` : `${Math.abs(days)}d before ${anchor}`;
}

export function TaskTable({
  tasks,
  columns,
  transactionId,
  today,
  toggleTask,
  setTaskStatus,
  setTaskNotes,
  cycleTaskPriority,
  deleteTask,
  emailHref,
}: {
  tasks: TaskRow[];
  columns: ColumnDef[];
  transactionId: string;
  /** Today as yyyy-mm-dd, for the overdue comparison. */
  today: string;
  toggleTask: (formData: FormData) => Promise<void>;
  setTaskStatus: (formData: FormData) => Promise<void>;
  setTaskNotes: (formData: FormData) => Promise<void>;
  cycleTaskPriority: (formData: FormData) => Promise<void>;
  deleteTask: (formData: FormData) => Promise<void>;
  emailHref: (t: TaskRow) => string;
}) {
  return (
    <div className={tableWrap}>
      <table className="w-full table-fixed" style={{ minWidth: taskTableMinWidth(columns) }}>
        <thead>
          <tr>
            {/* Tick column: no header text, it's a control not a field. */}
            <th className={th} style={{ width: "2.25rem" }} aria-label="Done" />
            {columns.map((c) => (
              <th
                key={c.key}
                className={`${th} ${c.align === "right" ? "text-right" : ""}`}
                style={{ width: c.width }}
              >
                {c.label}
              </th>
            ))}
            <th className={th} style={{ width: "9rem" }} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const done = t.status === "DONE";
            const overdue = !done && t.dueDate && fmtDate(t.dueDate) < today;
            return (
              <tr key={t.id} className={trHover}>
                <td className={td}>
                  <form action={toggleTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="transactionId" value={transactionId} />
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
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`${td} ${c.align === "right" ? "text-right" : ""}`}
                    style={{ backgroundColor: cellTint(c.key, t) }}
                  >
                    {cell(
                      c.key,
                      t,
                      { done, overdue: Boolean(overdue) },
                      {
                        transactionId,
                        setTaskStatus,
                        setTaskNotes,
                      },
                    )}
                  </td>
                ))}
                <td className={td}>
                  <span className="flex items-center justify-end gap-3">
                    <a
                      href={emailHref(t)}
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
                    </a>
                    <form action={cycleTaskPriority}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="transactionId" value={transactionId} />
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
                      transactionId={transactionId}
                      visibleToAgent={t.visibleToAgent}
                      visibleToClient={t.visibleToClient}
                    />
                    <DangerDelete
                      compact
                      action={deleteTask}
                      label="Delete"
                      description="Removes this task from the checklist."
                      hidden={{ id: t.id, transactionId }}
                    />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The priority tint that used to wash the whole row.
 *
 * Kept to the title cell only. Across a table it read as a status colour on
 * every field — a HIGH task looked like its *due date* was the urgent thing.
 */
function cellTint(key: string, t: TaskRow): string | undefined {
  if (key !== "title") return undefined;
  return priorityBadgeStyle(t.priority)?.backgroundColor as string | undefined;
}

function cell(
  key: string,
  t: TaskRow,
  state: { done: boolean; overdue: boolean },
  ctx: {
    transactionId: string;
    setTaskStatus: (formData: FormData) => Promise<void>;
    setTaskNotes: (formData: FormData) => Promise<void>;
  },
): ReactNode {
  switch (key) {
    case "title":
      return <span className={state.done ? "text-stone-400 line-through" : ""}>{t.title}</span>;
    case "notes":
      return (
        <TaskNotesField
          action={ctx.setTaskNotes}
          id={t.id}
          transactionId={ctx.transactionId}
          notes={t.notes}
        />
      );
    case "dueDate":
      return (
        <span className={state.overdue ? "font-medium text-red-600" : "text-stone-500"}>
          {fmtDayMonth(t.dueDate)}
        </span>
      );
    case "priority":
      return PRIORITY_LABEL[t.priority] ? (
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={priorityBadgeStyle(t.priority)}
        >
          {PRIORITY_LABEL[t.priority]}
        </span>
      ) : (
        <span className="text-stone-300">—</span>
      );
    case "status":
      return (
        <TaskStatusSelect
          action={ctx.setTaskStatus}
          id={t.id}
          transactionId={ctx.transactionId}
          status={t.status}
        />
      );
    case "completedAt":
      return <span className="text-stone-500">{fmtDayMonth(t.completedAt)}</span>;
    case "createdAt":
      return <span className="text-stone-500">{fmtDayMonth(t.createdAt)}</span>;
    case "assignee":
      return t.assignee?.name ? (
        <span className="text-stone-600">{t.assignee.name}</span>
      ) : (
        <span className="text-stone-300">Unassigned</span>
      );
    case "contact":
      return t.contact ? (
        <span className="text-stone-600">{t.contact.name}</span>
      ) : (
        <span className="text-stone-300">—</span>
      );
    case "source":
      return <span className="text-xs text-stone-500">{source(t)}</span>;
    case "visibility":
      return <span className="text-xs text-stone-500">{sharedWith(t)}</span>;
    default:
      return null;
  }
}
