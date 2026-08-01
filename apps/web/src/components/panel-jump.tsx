import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

/**
 * The one-icon shortcut in a SectionCard's shaded title strip, anchored right.
 *
 * The sidebar panels summarise what lives on a tab — key dates, deadlines,
 * listing figures, participants. Reading one and then hunting the tab strip
 * for where to change it is the long way round, so each panel carries a direct
 * way in. Deliberately a glyph rather than a labelled button: the title
 * already says what the section is, and a word here would compete with it.
 */
export function PanelJump({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-200/60 hover:text-brand-700"
    >
      <ArrowSquareOut size={15} weight="bold" aria-hidden />
    </Link>
  );
}
