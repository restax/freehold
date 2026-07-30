"use client";

import { PencilSimple } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * One editable row in the Key dates panel.
 *
 * Reads as text until you click it, then becomes a native date input that
 * saves on change and on blur. Native `<input type="date">` rather than a
 * hand-built calendar: it brings the platform picker, keyboard entry, and
 * locale formatting for free, and this panel is a sidebar — there's no room
 * for a month grid, and the header already has a full calendar popover for
 * browsing dates visually.
 *
 * Only the clicked row turns into an input. The panel is a reference list
 * that happens to be editable, not a form: seven date inputs stacked in a
 * 300px column is a wall of chrome for something you read far more often
 * than you change.
 */
export function KeyDateRow({
  action,
  transactionId,
  field,
  label,
  /** ISO yyyy-mm-dd, or "" when unset. */
  value,
  display,
  /** Contract-governed: changing it proposes an amendment, never overwrites. */
  governed = false,
  /** The pending amendment for this field, when one is outstanding. */
  proposed = null,
}: {
  action: (formData: FormData) => Promise<void>;
  transactionId: string;
  field: string;
  label: string;
  value: string;
  display: string;
  governed?: boolean;
  proposed?: string | null;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="group flex min-h-[26px] items-center justify-between gap-2">
      <dt className="shrink-0 text-stone-500">
        {label}
        {proposed && (
          <span
            className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800"
            title={`Amendment pending: ${proposed}`}
          >
            → {proposed}
          </span>
        )}
      </dt>
      {editing ? (
        <form action={action} className="flex items-center">
          <input type="hidden" name="id" value={transactionId} />
          <input type="hidden" name="field" value={field} />
          <DateField defaultValue={value} onDone={() => setEditing(false)} />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={governed ? `${label} — changing this raises an amendment` : `Edit ${label}`}
          className="flex items-center gap-1.5 rounded px-1 py-0.5 tabular-nums font-medium transition-colors hover:bg-stone-100"
        >
          {display}
          <PencilSimple
            size={11}
            aria-hidden
            className="text-stone-300 opacity-0 transition-opacity group-hover:opacity-100"
          />
        </button>
      )}
    </div>
  );
}

function DateField({ defaultValue, onDone }: { defaultValue: string; onDone: () => void }) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLInputElement>(null);
  const submitted = useRef(false);

  // Focus on open so the row is immediately typeable — the click that opened
  // it was the user asking to edit, not asking for a second click.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Close once the save round-trip finishes, not the moment it's fired: the
  // row swaps back to text only when that text is the saved value.
  useEffect(() => {
    if (submitted.current && !pending) onDone();
  }, [pending, onDone]);

  return (
    <input
      ref={ref}
      name="value"
      type="date"
      defaultValue={defaultValue}
      disabled={pending}
      className="w-[8.5rem] rounded border border-brand-600/40 bg-white px-1.5 py-0.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-600/20"
      onChange={(e) => {
        submitted.current = true;
        e.currentTarget.form?.requestSubmit();
      }}
      onKeyDown={(e) => {
        // Escape abandons the edit; the value never left the input.
        if (e.key === "Escape") onDone();
      }}
      onBlur={() => {
        // Leaving without changing anything is a cancel, not an empty save.
        if (!submitted.current) onDone();
      }}
    />
  );
}
