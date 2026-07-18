/** Composed empty state: a real message instead of a bare "No X yet." line. */
export function EmptyState({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-10 text-center">
      <p className="font-medium text-stone-700">{title}</p>
      {hint && (
        <p className="max-w-md text-balance text-sm leading-relaxed text-stone-500">{hint}</p>
      )}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
