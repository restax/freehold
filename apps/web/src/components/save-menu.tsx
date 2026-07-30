import { CaretDown } from "@phosphor-icons/react/dist/ssr";

/**
 * A Save button with a caret dropdown holding the destructive action —
 * replaces the standalone DangerDelete bar sitting under a form, which reads
 * as "a delete button is always on screen" even though it's a two-step
 * confirm. Tucking it behind the same disclosure the caret already opens
 * keeps delete reachable without it ever being the first thing visible.
 *
 * No client JS: the caret and the delete confirm are both native <details>
 * disclosures, and the Save/"Send test" buttons target `formId` via the
 * `form` attribute so they can sit outside the edit <form> itself — which is
 * what lets the delete <form> below live as a sibling, not (invalidly)
 * nested inside the edit form.
 */
export function SaveMenu({
  formId,
  deleteAction,
  deleteLabel,
  deleteDescription,
  hidden,
}: {
  formId: string;
  deleteAction: (formData: FormData) => Promise<void>;
  deleteLabel: string;
  deleteDescription: string;
  hidden: Record<string, string>;
}) {
  return (
    <div className="inline-flex rounded-md shadow-xs">
      <button
        type="submit"
        form={formId}
        className="rounded-l-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-[var(--color-brand-fg)] transition hover:bg-brand-600 active:scale-[0.98]"
      >
        Save
      </button>
      <details className="group relative">
        <summary
          aria-label="More save options"
          className="flex h-full cursor-pointer list-none items-center rounded-r-md border-l border-black/10 bg-brand-700 px-1.5 text-[var(--color-brand-fg)] transition hover:bg-brand-600"
        >
          <CaretDown
            size={12}
            weight="bold"
            className="transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-stone-200 bg-white p-2 text-left shadow-lg">
          <details>
            <summary className="cursor-pointer select-none rounded-md px-2 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-50">
              {deleteLabel}…
            </summary>
            <form action={deleteAction} className="mt-2 flex flex-col gap-2 px-2 pb-1">
              {Object.entries(hidden).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <p className="text-xs text-red-800">{deleteDescription}</p>
              <input
                name="confirm"
                required
                placeholder="Type DELETE"
                autoComplete="off"
                className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-400"
              />
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700"
              >
                {deleteLabel}
              </button>
            </form>
          </details>
        </div>
      </details>
    </div>
  );
}
