import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A clickable reference to a transaction, styled the same way everywhere it
 * appears: an earthy-green rounded chip, one shade darker on hover. See
 * CLAUDE.md ("Address links") — every propertyAddress link on a dashboard
 * page uses this instead of a bare text link, for the same reason
 * SectionCard replaced bare `<h2>` section titles.
 */
export function AddressPill({
  href,
  children,
  icon,
  className = "",
}: {
  href: string;
  children: ReactNode;
  /** Leading glyph — used for the closing-day banners, omitted elsewhere. */
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-lg bg-[var(--pill-green)] px-2.5 py-1 text-sm font-medium text-[var(--pill-green-text)] transition-colors hover:bg-[var(--pill-green-hover)] ${className}`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}
