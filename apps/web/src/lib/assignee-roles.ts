import type { AssigneeRole, AssigneeSlot } from "@freehold/db";

/**
 * Turning a template's formal role (TC1/TC2/AGENT) into an actual person on
 * one transaction.
 *
 * TC1/TC2 are seats on the file — look up whichever TransactionAssignee
 * currently holds that slot. AGENT has no seat to hold: the primary agent is
 * a CRM Contact, not a workspace User, so there's nothing to set a Task's
 * `assigneeId` FK to. An unfilled slot (nobody assigned TC2 yet) resolves to
 * null rather than falling back to anyone — the role still shows on the row,
 * the task just sits unassigned until someone claims the seat.
 */
export function resolveAssigneeRole(
  role: AssigneeRole | null | undefined,
  assignees: Array<{ userId: string; slot: AssigneeSlot | null }>,
): string | null {
  if (role !== "TC1" && role !== "TC2") return null;
  return assignees.find((a) => a.slot === role)?.userId ?? null;
}
