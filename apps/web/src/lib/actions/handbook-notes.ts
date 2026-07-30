"use server";

import { HandbookGrade, type HandbookSubject, prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { optStr, str } from "@/lib/forms";
import {
  canSetGrade,
  canWriteNotes,
  type HandbookSubjectType,
  type MemberRole,
} from "@/lib/handbook";
import { handbookState } from "@/lib/plans";
import { getMemberRole, requireTenant } from "@/lib/tenant";

const SUBJECTS: HandbookSubjectType[] = ["CLIENT", "CONTACT", "MEMBER", "TRANSACTION"];
const GRADES = Object.values(HandbookGrade);

/**
 * Resolve the caller's authority from the session, never from the form.
 *
 * The subject type arrives in a hidden input, and a hidden input saying
 * "MEMBER" is exactly how someone would try to write or read a staff note
 * they shouldn't. So the role is looked up server-side and run through the
 * same predicate the UI uses, rather than trusting that the UI declined to
 * render the form.
 */
async function authorize(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const subjectType = str(formData, "subjectType") as HandbookSubjectType;
  const subjectId = str(formData, "subjectId");
  if (!SUBJECTS.includes(subjectType) || !subjectId) return null;

  const state = await handbookState(tenantId);
  if (!state.notes) return null;

  const role = (await getMemberRole(tenantId, session.user.id)) as MemberRole;
  const member = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId: session.user.id },
    select: { id: true },
  });
  if (!member) return null;

  const viewer = { memberId: member.id, role };
  if (!canWriteNotes(viewer, subjectType)) return null;

  return { tenantId, session, subjectType, subjectId, viewer, role };
}

/** Where to refresh after a change — the page the note is attached to. */
function pathFor(subjectType: HandbookSubjectType, subjectId: string, back: string): string {
  if (back) return back;
  if (subjectType === "CLIENT") return `/dashboard/clients/${subjectId}`;
  if (subjectType === "CONTACT") return `/dashboard/contacts/${subjectId}`;
  if (subjectType === "TRANSACTION") return `/dashboard/transactions/${subjectId}`;
  return "/dashboard/team";
}

export async function addHandbookNote(formData: FormData) {
  const ctx = await authorize(formData);
  if (!ctx) return;
  const body = str(formData, "body").trim();
  if (!body) return;

  // A date-only column: parsed as UTC midnight so "30 April" doesn't become
  // the 29th for anyone west of Greenwich.
  const untilRaw = optStr(formData, "relevantUntil");
  const relevantUntil =
    untilRaw && /^\d{4}-\d{2}-\d{2}$/.test(untilRaw) ? new Date(`${untilRaw}T00:00:00.000Z`) : null;

  await withTenant(ctx.tenantId, (tx) =>
    tx.handbookNote.create({
      data: {
        tenantId: ctx.tenantId,
        subjectType: ctx.subjectType as HandbookSubject,
        subjectId: ctx.subjectId,
        // Capped rather than rejected: a note is a sentence, and losing a
        // long one to a validation error would be worse than truncating it.
        body: body.slice(0, 1000),
        authorId: ctx.session.user.id,
        authorName: ctx.session.user.name ?? null,
        relevantUntil,
      },
    }),
  );

  // Audited because a note about a person is a management record, and who
  // wrote one and when is the sort of thing that gets asked later.
  if (ctx.subjectType === "MEMBER") {
    logAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.session.user.id,
      actorEmail: ctx.session.user.email,
      action: "handbook.member_note_added",
      summary: `Added a Handbook note about a team member`,
      subjectType: "member",
      subjectId: ctx.subjectId,
    });
  }

  revalidatePath(pathFor(ctx.subjectType, ctx.subjectId, str(formData, "back")));
}

export async function deleteHandbookNote(formData: FormData) {
  const ctx = await authorize(formData);
  if (!ctx) return;
  const id = str(formData, "id");
  if (!id) return;

  // deleteMany, not delete: it takes a where clause, so a note belonging to
  // another subject can't be removed by passing its id to the wrong form.
  await withTenant(ctx.tenantId, (tx) =>
    tx.handbookNote.deleteMany({
      where: {
        id,
        subjectType: ctx.subjectType as HandbookSubject,
        subjectId: ctx.subjectId,
      },
    }),
  );

  revalidatePath(pathFor(ctx.subjectType, ctx.subjectId, str(formData, "back")));
}

/**
 * Set (or clear) the working-relationship grade on a client or contact.
 *
 * Owners and admins only. The grade is a judgement about whether the business
 * wants the work — it stops a new coordinator accepting a file the team
 * already decided against, so it isn't something any member should be able to
 * flip.
 */
export async function setHandbookGrade(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const state = await handbookState(tenantId);
  if (!state.notes) return;

  const role = (await getMemberRole(tenantId, session.user.id)) as MemberRole;
  const member = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId: session.user.id },
    select: { id: true },
  });
  if (!member || !canSetGrade({ memberId: member.id, role })) return;

  const kind = str(formData, "kind");
  const id = str(formData, "subjectId");
  if (!id || (kind !== "client" && kind !== "contact")) return;

  const raw = str(formData, "grade");
  // Empty means "no opinion", which is different from a bad grade and has to
  // stay expressible — otherwise a mis-click can never be undone.
  const grade = GRADES.includes(raw as HandbookGrade) ? (raw as HandbookGrade) : null;
  const note = optStr(formData, "gradeNote")?.slice(0, 1000) ?? null;

  await withTenant(tenantId, async (tx) => {
    const data = { handbookGrade: grade, handbookGradeNote: note };
    if (kind === "client") await tx.client.updateMany({ where: { id }, data });
    else await tx.contact.updateMany({ where: { id }, data });
  });

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "handbook.grade_set",
    summary: grade ? `Graded a ${kind} ${grade}` : `Cleared a ${kind}'s grade`,
    subjectType: kind,
    subjectId: id,
  });

  revalidatePath(kind === "client" ? `/dashboard/clients/${id}` : `/dashboard/contacts/${id}`);
}
