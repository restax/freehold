/**
 * Which columns the transaction's task list shows, in which order.
 *
 * Same shape and rules as the transactions and contacts catalogues — see
 * lib/table-columns.ts for the resolution behaviour.
 *
 * **Only data is pickable.** The done-checkbox, the email link, the priority
 * flag, the portal-visibility toggles and delete are row controls, not
 * columns: they're how you act on a task rather than something you read off
 * it, and a checklist you can't tick is not a checklist. They stay fixed at
 * either end of the row whatever the picker says.
 *
 * The defaults reproduce the list as it looked before it was pickable — due
 * date, then task, then priority — so nobody's existing view changes until
 * they ask it to. `title` is locked but listed second on purpose: locked
 * columns are only forced to the front when a stored preference omits them,
 * so naming it here keeps the date in the left column where it has always
 * been.
 */

import { type ColumnDef, makeColumnSet } from "./table-columns";

export type { ColumnDef } from "./table-columns";

export const TASK_COLUMNS: readonly ColumnDef[] = [
  // What it is
  { key: "title", label: "Task", group: "What", width: "22rem", locked: true },
  { key: "notes", label: "Notes", group: "What", width: "18rem" },
  { key: "priority", label: "Priority", group: "What", width: "7rem" },
  { key: "status", label: "Status", group: "What", width: "7rem" },
  // When it's due
  { key: "dueDate", label: "Due", group: "Timing", width: "7rem" },
  { key: "completedAt", label: "Completed", group: "Timing", width: "8rem", align: "right" },
  { key: "createdAt", label: "Added", group: "Timing", width: "8rem", align: "right" },
  // Who's involved
  { key: "assignee", label: "Assigned to", group: "Who", width: "11rem" },
  { key: "contact", label: "Contact", group: "Who", width: "12rem" },
  // Where it came from, and who can see it
  { key: "source", label: "From plan", group: "Reference", width: "9rem" },
  { key: "visibility", label: "Shared with", group: "Reference", width: "10rem" },
] as const;

/** The list exactly as it read before the picker existed. */
export const DEFAULT_TASK_COLUMNS = ["dueDate", "title", "priority"] as const;

const SET = makeColumnSet(TASK_COLUMNS, DEFAULT_TASK_COLUMNS);

export const TASK_LOCKED_KEYS = SET.lockedKeys;
export const taskColumnByKey = SET.byKey;
export const taskColumnGroups = SET.groups;
export const resolveTaskColumns = SET.resolve;
export const normalizeTaskColumns = SET.normalize;
export const taskTableMinWidth = SET.minWidth;
