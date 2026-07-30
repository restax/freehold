import { Sun } from "@phosphor-icons/react/dist/ssr";
import { SectionCard } from "@/components/section-card";

/**
 * "Today at a glance" — the Handbook's one written paragraph.
 *
 * Shown from cache and rewritten in the background when it goes off, so
 * opening the dashboard never waits on a model. The consequence is that a
 * brand-new workspace sees the placeholder once and the real thing on the
 * next visit, which is a better trade than a spinner at the top of every
 * morning's first page load.
 *
 * Presented as prose with no heading hierarchy, no bullets and no icons in
 * the body. It is meant to be read in one glance and then ignored — the
 * lists below it are the actual working surface, and a briefing that
 * competes with them for attention is a briefing that gets in the way.
 */
export function HandbookGlance({
  text,
  pending,
}: {
  text: string | null;
  /** No briefing yet, but one is being written now. */
  pending: boolean;
}) {
  if (!text && !pending) return null;

  return (
    <SectionCard title="Today at a glance" icon={<Sun size={15} weight="fill" aria-hidden />}>
      {text ? (
        <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
          {text}
        </p>
      ) : (
        <p className="text-sm text-stone-400">
          Writing your first one now — it'll be here next time you look.
        </p>
      )}
    </SectionCard>
  );
}
