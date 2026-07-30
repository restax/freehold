import { Lightbulb } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { HandbookGradeBadge } from "@/components/handbook-grade";
import { SectionCard } from "@/components/section-card";
import { fmtDayMonth } from "@/lib/format";
import type { HandbookGradeValue, PooledNote } from "@/lib/handbook";

/** A graded party shown alongside the notes, with a link to their record. */
export interface RecapGrade {
  label: string;
  grade: HandbookGradeValue;
  reason: string | null;
  href: string;
}

const SOURCE_HREF: Record<string, (id: string) => string> = {
  CLIENT: (id) => `/dashboard/clients/${id}`,
  CONTACT: (id) => `/dashboard/contacts/${id}`,
  TRANSACTION: (id) => `/dashboard/transactions/${id}`,
};

const SOURCE_NOTE: Record<string, string> = {
  TRANSACTION: "this file",
  CLIENT: "their client",
  CONTACT: "on this file",
};

/**
 * Everything the team has written down that bears on this transaction, pooled
 * from the file, its client and the people on it.
 *
 * Deliberately not AI-written. This is the surface a coordinator checks
 * *before acting* — before ringing someone, before sending a document for
 * payment — so it has to be instantaneous, exactly what was written, and
 * available whether or not the workspace wants an AI anywhere near its data.
 * A generated paragraph here would be slower, occasionally wrong, and would
 * stop working the moment someone switched the summary off.
 *
 * Grouped by where each note came from, and every group links back to it.
 * Without that, a note that needs correcting is a hunt: the reader knows the
 * instruction is wrong but not which of four records it was written on.
 */
export function HandbookRecap({
  notes,
  grades,
  now = new Date(),
}: {
  notes: PooledNote[];
  grades: RecapGrade[];
  now?: Date;
}) {
  // A recap of nothing is worse than no recap — an empty card on every file
  // teaches people to stop looking at it.
  if (notes.length === 0 && grades.length === 0) return null;

  const groups = new Map<
    string,
    { label: string; type: string; id: string; notes: PooledNote[] }
  >();
  for (const p of notes) {
    const key = `${p.source.type}:${p.source.id}`;
    const g = groups.get(key) ?? {
      label: p.source.label,
      type: p.source.type,
      id: p.source.id,
      notes: [],
    };
    g.notes.push(p);
    groups.set(key, g);
  }

  return (
    <SectionCard
      title="Worth knowing"
      icon={<Lightbulb size={15} weight="fill" aria-hidden />}
      count={notes.length || undefined}
      bodyClassName="p-3"
    >
      <p className="mb-3 text-xs text-stone-400">
        From your Handbook — this file, its client, and the people on it.
      </p>

      {grades.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1.5 border-b border-stone-100 pb-3">
          {grades.map((g) => (
            <li key={g.href} className="flex items-start gap-2 text-sm">
              <HandbookGradeBadge grade={g.grade} reason={g.reason} />
              <div className="min-w-0 flex-1">
                <Link href={g.href} className="font-medium text-brand-700 hover:underline">
                  {g.label}
                </Link>
                {g.reason && <p className="text-xs leading-snug text-stone-500">{g.reason}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        {[...groups.values()].map((g) => {
          const href = SOURCE_HREF[g.type]?.(g.id);
          return (
            <div key={`${g.type}:${g.id}`}>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                {href ? (
                  <Link href={href} className="hover:text-stone-600 hover:underline">
                    {g.label}
                  </Link>
                ) : (
                  g.label
                )}
                <span className="ml-1 font-normal normal-case tracking-normal">
                  · {SOURCE_NOTE[g.type] ?? ""}
                </span>
              </p>
              <ul className="flex flex-col gap-1">
                {g.notes.map((p) => (
                  <li key={p.note.id} className="text-sm leading-snug text-stone-700">
                    {p.note.body}
                    {p.note.relevantUntil && (
                      <span className="ml-1 text-xs text-stone-400">
                        (until {fmtDayMonth(p.note.relevantUntil, now)})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
