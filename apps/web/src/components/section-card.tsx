import type { ReactNode } from "react";

/**
 * A panel with a shaded title strip.
 *
 * The house pattern for sections from here on. A page of white cards with
 * bold text floating at the top of each reads as one continuous surface —
 * you have to work out where one section ends and the next begins. A tinted
 * strip with a hairline under it draws that boundary without a heavy border,
 * and gives every section a consistent place for its icon, count, and
 * right-hand action.
 *
 * See CLAUDE.md ("Section headers") — new sections should use this rather
 * than an <h2> above a bare card.
 */
export function SectionCard({
  title,
  tooltip,
  icon,
  count,
  action,
  children,
  className = "",
  bodyClassName = "p-4",
}: {
  title: string;
  /** Hover text on the title, for a section whose name needs a sentence. */
  tooltip?: string;
  /** Small glyph left of the title, in the muted header colour. */
  icon?: ReactNode;
  /** Optional pill after the title — a row count, an unread total. */
  count?: number | string;
  /** Right-aligned control in the header: a link, a filter, a picker. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Set to "" when the body supplies its own padding, e.g. a full-bleed table. */
  bodyClassName?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgb(41_37_36/0.04)] ${className}`}
    >
      <header className="flex items-center gap-2 border-b border-stone-200/80 bg-[var(--section-header)] px-4 py-2.5">
        {icon && <span className="shrink-0 text-stone-400">{icon}</span>}
        <h2 className="text-sm font-semibold text-stone-800" title={tooltip}>
          {title}
        </h2>
        {count != null && (
          <span className="rounded-full bg-stone-200/70 px-1.5 py-0.5 text-xs font-medium text-stone-600">
            {count}
          </span>
        )}
        {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
