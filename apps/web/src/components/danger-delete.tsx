import { XCircle } from "@phosphor-icons/react/dist/ssr";

/**
 * Two-step delete, no JavaScript required: the action stays folded behind a
 * <details> and only fires when the user types DELETE. Server actions must
 * independently verify the confirm field — this component is the UI half of
 * the contract, never the enforcement.
 *
 * Compact mode trades the text trigger for a bare circle-X icon — the label
 * still does the talking through `aria-label`/`title` and the confirmation
 * copy below, it just isn't spelled out next to every row.
 */
export function DangerDelete({
  action,
  label,
  description,
  hidden,
  compact = false,
}: {
  action: (formData: FormData) => Promise<void>;
  label: string;
  description: string;
  hidden: Record<string, string>;
  compact?: boolean;
}) {
  return (
    <details className={compact ? "" : "rounded-xl border border-red-200/70 bg-red-50/40 p-4"}>
      <summary
        aria-label={label}
        title={label}
        className={
          compact
            ? "flex h-5 w-5 cursor-pointer select-none list-none items-center justify-center text-stone-300 transition-colors hover:text-red-600"
            : "cursor-pointer select-none text-sm font-medium text-stone-400 transition-colors hover:text-red-700"
        }
      >
        {compact ? <XCircle size={17} weight="fill" aria-hidden /> : `${label}…`}
      </summary>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <p className={`w-full text-red-800 ${compact ? "text-xs" : "text-sm"}`}>{description}</p>
        <input
          name="confirm"
          required
          placeholder="Type DELETE"
          autoComplete="off"
          className="w-32 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-400"
        />
        <button
          type="submit"
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700"
        >
          {label}
        </button>
      </form>
    </details>
  );
}
