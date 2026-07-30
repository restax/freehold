import Link from "next/link";

/** A trail of "where you are" — every entry but the last is a link. */
export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-stone-400">
      {items.map((it, i) => (
        <span key={it.label} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>/</span>}
          {it.href ? (
            <Link href={it.href} className="hover:text-brand-700 hover:underline">
              {it.label}
            </Link>
          ) : (
            <span className="font-medium text-stone-700">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
