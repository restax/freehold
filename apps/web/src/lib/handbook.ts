/**
 * The Handbook's rules: who may read and write a note, which notes are still
 * current, and which of them belong on a given transaction.
 *
 * Everything here is pure and unit-tested, deliberately. Two of these rules
 * are the kind that are quietly wrong for a year:
 *
 *   * A note about a *person* ("needs to improve phone communication") is a
 *     management record. It must never reach the person it describes — not on
 *     screen, and not folded into a summary written for them.
 *   * A note with a shelf life ("on holiday April 2027") must stop being
 *     presented as current once it isn't, without being destroyed.
 *
 * Getting either wrong is invisible in a screenshot, so it is settled here in
 * functions with tests rather than in a query or a template.
 */

export type HandbookSubjectType = "CLIENT" | "CONTACT" | "MEMBER" | "TRANSACTION";
export type HandbookGradeValue = "A" | "B" | "C" | "D" | "F";

/** Workspace role, as `Member.role` stores it. */
export type MemberRole = "owner" | "admin" | "member";

export interface HandbookNoteLike {
  id: string;
  subjectType: HandbookSubjectType;
  subjectId: string;
  body: string;
  authorName: string | null;
  relevantUntil: Date | null;
  createdAt: Date;
}

/** Someone asking to see or change notes. */
export interface Viewer {
  memberId: string;
  role: MemberRole;
}

export function isAdminRole(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Can this person read notes about `subjectType`?
 *
 * Everything except MEMBER is ordinary shared knowledge — the whole point is
 * that a new coordinator sees it. MEMBER notes are the exception and are
 * owner/admin only, including notes about oneself: a coaching record the
 * subject can read is a coaching record nobody writes honestly, and the
 * feature would quietly become useless.
 */
export function canReadNotes(viewer: Viewer, subjectType: HandbookSubjectType): boolean {
  if (subjectType === "MEMBER") return isAdminRole(viewer.role);
  return true;
}

/** Same rule for writing: only owners/admins record notes about people. */
export function canWriteNotes(viewer: Viewer, subjectType: HandbookSubjectType): boolean {
  return canReadNotes(viewer, subjectType);
}

/**
 * Grades are visible to everyone, unlike member notes.
 *
 * That asymmetry is the point of the grade. A junior coordinator has to be
 * able to see that a client is graded F and why, or they will accept the work
 * the business already decided it didn't want — which is the exact situation
 * the grade exists to prevent.
 */
export function canReadGrade(): boolean {
  return true;
}

/** Setting one is a judgement about the business's relationships, so it stays
 *  with owners and admins. */
export function canSetGrade(viewer: Viewer): boolean {
  return isAdminRole(viewer.role);
}

/**
 * Has this note passed its "relevant until" date?
 *
 * Date-only comparison: a note good until 30 April is still good all day on
 * the 30th. Notes without a date never expire.
 */
export function isExpired(note: Pick<HandbookNoteLike, "relevantUntil">, now: Date): boolean {
  if (!note.relevantUntil) return false;
  const until = Date.UTC(
    note.relevantUntil.getUTCFullYear(),
    note.relevantUntil.getUTCMonth(),
    note.relevantUntil.getUTCDate(),
  );
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return today > until;
}

/** The still-current notes, for anywhere that presents them as fact. */
export function currentNotes<T extends Pick<HandbookNoteLike, "relevantUntil">>(
  notes: T[],
  now: Date,
): T[] {
  return notes.filter((n) => !isExpired(n, now));
}

/* ---------------- Pooling onto a transaction ---------------- */

/** Where a pooled note came from, so the panel can say so and link back. */
export interface HandbookSource {
  type: HandbookSubjectType;
  id: string;
  /** "Sunrise Realty", "Alexis Chen" — what to show as the group heading. */
  label: string;
}

export interface PooledNote {
  note: HandbookNoteLike;
  source: HandbookSource;
}

/**
 * Everything worth knowing on one transaction, gathered from the places it is
 * actually written down.
 *
 * A coordinator writes "broker's office reviews documents before final
 * payment" once, on the client — not on all eleven of that client's files. So
 * the recap has to reach up: the file itself, its client, and the contacts
 * who are parties to it. Without that the notes would have to be copied onto
 * every transaction to be useful, and nobody would keep them up to date.
 *
 * Notes about *people* are excluded entirely, at every role. They are
 * management records about staff, not context about the deal, and a panel the
 * whole team reads is the last place they belong — so this takes no viewer
 * argument, and there is no flag that turns them on.
 */
export function poolForTransaction(
  input: {
    transaction: { id: string; label: string; notes: HandbookNoteLike[] };
    client: { id: string; label: string; notes: HandbookNoteLike[] } | null;
    contacts: Array<{ id: string; label: string; notes: HandbookNoteLike[] }>;
  },
  now: Date,
): PooledNote[] {
  const out: PooledNote[] = [];

  const take = (
    type: HandbookSubjectType,
    id: string,
    label: string,
    notes: HandbookNoteLike[],
  ) => {
    for (const note of currentNotes(notes, now)) {
      if (note.subjectType === "MEMBER") continue;
      out.push({ note, source: { type, id, label } });
    }
  };

  // Order is the point: the file's own notes are the most specific and come
  // first, then the client's standing instructions, then the people involved.
  take("TRANSACTION", input.transaction.id, input.transaction.label, input.transaction.notes);
  if (input.client) take("CLIENT", input.client.id, input.client.label, input.client.notes);
  for (const c of input.contacts) take("CONTACT", c.id, c.label, c.notes);

  return out;
}

/**
 * What the AI summary is allowed to see, for one person's own Today screen.
 *
 * Member notes are included only when the reader is an owner/admin *and* the
 * note isn't about the reader. Both halves matter: the first keeps staff
 * records away from staff, the second stops an admin's own summary quoting
 * their own file back at them, which reads like the software is grading them.
 */
export function summaryNotesFor(
  viewer: Viewer,
  notes: HandbookNoteLike[],
  now: Date,
): HandbookNoteLike[] {
  return currentNotes(notes, now).filter((n) => {
    if (n.subjectType !== "MEMBER") return true;
    if (!isAdminRole(viewer.role)) return false;
    return n.subjectId !== viewer.memberId;
  });
}

/* ---------------- Display ---------------- */

export const GRADE_LABEL: Record<HandbookGradeValue, string> = {
  A: "A — excellent",
  B: "B — good",
  C: "C — mixed",
  D: "D — difficult",
  F: "F — do not take work",
};

export const GRADE_VALUES: HandbookGradeValue[] = ["A", "B", "C", "D", "F"];

/**
 * Badge tone per grade. D and F share the warning/danger end deliberately —
 * the grade is there to slow someone down, so it should look like it.
 */
export function gradeTone(grade: HandbookGradeValue): "success" | "neutral" | "warning" | "danger" {
  if (grade === "A") return "success";
  if (grade === "B" || grade === "C") return "neutral";
  if (grade === "D") return "warning";
  return "danger";
}
