import { Badge, type BadgeTone } from "@/components/badges";
import { setHandbookGrade } from "@/lib/actions/handbook-notes";
import { GRADE_LABEL, GRADE_VALUES, gradeTone, type HandbookGradeValue } from "@/lib/handbook";
import { btnGhost, input, label } from "@/lib/ui";

/**
 * The working-relationship grade badge — how this business has found dealing
 * with someone.
 *
 * Shown to everyone, unlike the notes about staff. A grade that only managers
 * can see would not do the job it exists for: stopping a new coordinator
 * accepting work from a client the team already decided against, months or
 * years after the person who made that call has forgotten.
 *
 * The reason travels with it. "F" alone ages into a mystery; "F — blamed us
 * for a deal falling through, do not accept work" still means something two
 * years later, which is exactly when it will be read.
 */
export function HandbookGradeBadge({
  grade,
  reason,
}: {
  grade: HandbookGradeValue | null;
  reason?: string | null;
}) {
  if (!grade) return null;
  return (
    <Badge tone={gradeTone(grade) as BadgeTone}>
      <span title={reason || GRADE_LABEL[grade]}>{grade}</span>
    </Badge>
  );
}

/** Setting the grade — owners and admins only; see canSetGrade. */
export function HandbookGradeControl({
  kind,
  subjectId,
  grade,
  reason,
}: {
  kind: "client" | "contact";
  subjectId: string;
  grade: HandbookGradeValue | null;
  reason: string | null;
}) {
  return (
    <form action={setHandbookGrade} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <label className={label}>
        <span title="How this business has found working with them. Everyone on the team can see it.">
          Working relationship
        </span>
        <select name="grade" defaultValue={grade ?? ""} className={input}>
          {/* Blank is a real answer — no opinion recorded — and has to stay
              reachable so a mis-set grade can be undone. */}
          <option value="">Not graded</option>
          {GRADE_VALUES.map((g) => (
            <option key={g} value={g}>
              {GRADE_LABEL[g]}
            </option>
          ))}
        </select>
      </label>
      <label className={`${label} min-w-[16rem] flex-1`}>
        Why
        <input
          name="gradeNote"
          defaultValue={reason ?? ""}
          maxLength={1000}
          placeholder="Briefly state the reason for this rating…"
          className={input}
        />
      </label>
      <button type="submit" className={btnGhost}>
        Save
      </button>
    </form>
  );
}
