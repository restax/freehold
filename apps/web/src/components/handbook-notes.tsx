import { NotePencil } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { addHandbookNote, deleteHandbookNote } from "@/lib/actions/handbook-notes";
import { fmtDayMonth } from "@/lib/format";
import { type HandbookNoteLike, type HandbookSubjectType, isExpired } from "@/lib/handbook";
import { btn, btnGhost, input, label } from "@/lib/ui";

/**
 * The Handbook panel: the things this team knows about one client, contact,
 * teammate or file.
 *
 * The copy deliberately never says "memory", "skills", "context" or "AI". A
 * coordinator recognises "the things you'd tell someone new on their first
 * day"; nobody outside this industry's software has to learn what a retrieval
 * store is to write down that a client prefers a phone call.
 *
 * Reused on all four subject pages so a note looks and behaves identically
 * wherever it is kept — the alternative was four near-identical lists that
 * drift.
 */
export function HandbookNotes({
  subjectType,
  subjectId,
  notes,
  canWrite,
  locked = false,
  now = new Date(),
  title = "Handbook",
  hint,
  back = "",
}: {
  subjectType: HandbookSubjectType;
  subjectId: string;
  notes: HandbookNoteLike[];
  /** False for a reader who may see the notes but not change them. */
  canWrite: boolean;
  /** Plan-gated: show the pitch and an upgrade link instead of the list. */
  locked?: boolean;
  now?: Date;
  title?: string;
  /** One line saying what belongs here, tuned per subject. */
  hint?: string;
  /** Path to revalidate, when the panel isn't on the subject's own page. */
  back?: string;
}) {
  if (locked) {
    return (
      <SectionCard title={title} icon={<NotePencil size={15} weight="fill" aria-hidden />}>
        <p className="mb-3 text-sm text-stone-500">
          {hint ?? "Keep what your team knows here, beside the work it applies to."}
        </p>
        <Link href="/pricing" className={btnGhost}>
          See plans
        </Link>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={title}
      icon={<NotePencil size={15} weight="fill" aria-hidden />}
      count={notes.length || undefined}
    >
      {hint && <p className="mb-3 text-sm text-stone-500">{hint}</p>}

      {notes.length > 0 ? (
        <ul className="mb-3 flex flex-col divide-y divide-stone-100">
          {notes.map((n) => {
            const expired = isExpired(n, now);
            return (
              <li key={n.id} className="group flex items-start gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  {/* An expired note is struck through rather than hidden: it
                      stopped being true, it didn't stop being a thing someone
                      wrote, and it should be deleted deliberately. */}
                  <p className={expired ? "text-stone-400 line-through" : "text-stone-700"}>
                    {n.body}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-400">
                    {n.authorName ? `${n.authorName} · ` : ""}
                    {fmtDayMonth(n.createdAt, now)}
                    {n.relevantUntil && (
                      <span className={expired ? "text-amber-700" : ""}>
                        {expired
                          ? ` · expired ${fmtDayMonth(n.relevantUntil, now)}`
                          : ` · until ${fmtDayMonth(n.relevantUntil, now)}`}
                      </span>
                    )}
                  </p>
                </div>
                {canWrite && (
                  <form action={deleteHandbookNote} className="shrink-0">
                    <input type="hidden" name="subjectType" value={subjectType} />
                    <input type="hidden" name="subjectId" value={subjectId} />
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      aria-label="Delete this note"
                      className="text-xs text-stone-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-stone-400">Nothing noted yet.</p>
      )}

      {canWrite && (
        <form action={addHandbookNote} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="subjectType" value={subjectType} />
          <input type="hidden" name="subjectId" value={subjectId} />
          <input type="hidden" name="back" value={back} />
          <label className={`${label} min-w-[14rem] flex-1`}>
            Add a note
            <input
              name="body"
              required
              maxLength={1000}
              placeholder={PLACEHOLDER[subjectType]}
              className={input}
            />
          </label>
          <label className={label}>
            <span title="Leave blank for something that stays true. Set a date for something that won't — a holiday, a temporary arrangement.">
              Until (optional)
            </span>
            <input name="relevantUntil" type="date" className={input} />
          </label>
          <button type="submit" className={btn}>
            Add
          </button>
        </form>
      )}
    </SectionCard>
  );
}

/** Examples rather than instructions — the fastest way to convey what belongs
 *  here is to show the shape of a good one. */
const PLACEHOLDER: Record<HandbookSubjectType, string> = {
  CLIENT: "Wants a phone call if a contract date moves",
  CONTACT: "Installs signs in Plymouth County only",
  MEMBER: "Works evenings; check emails before they go out",
  TRANSACTION: "Broker's office reviews the file before final payment",
};

/**
 * A person's Handbook notes, with the warning that they aren't shared.
 *
 * Separated from the generic panel because this is the one subject where the
 * writer needs telling who can read it. Someone typing an honest assessment
 * of a colleague deserves to know it isn't about to appear on that
 * colleague's screen — and equally, that it is visible to the other admins.
 */
export function MemberHandbookNotes(props: {
  subjectId: string;
  notes: HandbookNoteLike[];
  canWrite: boolean;
  locked?: boolean;
  now?: Date;
  personName: string;
  back?: string;
}) {
  const { personName, ...rest } = props;
  return (
    <HandbookNotes
      {...rest}
      subjectType="MEMBER"
      title={`Notes on ${personName}`}
      hint="Only owners and admins can read these — not the person they're about. Useful for the things you'd want a new manager to know."
    />
  );
}

/** Notes as a plain read-only list, for panels that pool from elsewhere. */
export function HandbookNoteList({
  notes,
  now = new Date(),
}: {
  notes: HandbookNoteLike[];
  now?: Date;
}) {
  if (notes.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {notes.map((n) => (
        <li key={n.id} className="text-sm text-stone-700">
          {n.body}
          {n.relevantUntil && (
            <span className="ml-1 text-xs text-stone-400">
              (until {fmtDayMonth(n.relevantUntil, now)})
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
