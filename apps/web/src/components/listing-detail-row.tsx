"use client";

import { PencilSimple } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * One editable row in the Listing details panel — same click-to-edit shape
 * as KeyDateRow, but for free text/numbers instead of a date, so it saves on
 * Enter or on leaving the field rather than on every change.
 */
export function ListingDetailRow({
  action,
  transactionId,
  field,
  label,
  value,
  display,
  inputMode = "text",
  placeholder,
}: {
  action: (formData: FormData) => Promise<void>;
  transactionId: string;
  field: string;
  label: string;
  /** Raw editable value — the display string minus formatting, "" when unset. */
  value: string;
  display: string;
  inputMode?: "text" | "numeric";
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="group flex min-h-[26px] items-center justify-between gap-2">
      <dt className="shrink-0 text-stone-500">{label}</dt>
      {editing ? (
        <form action={action} className="flex items-center">
          <input type="hidden" name="id" value={transactionId} />
          <input type="hidden" name="field" value={field} />
          <TextField
            defaultValue={value}
            inputMode={inputMode}
            placeholder={placeholder}
            onDone={() => setEditing(false)}
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={`Edit ${label}`}
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

function TextField({
  defaultValue,
  inputMode,
  placeholder,
  onDone,
}: {
  defaultValue: string;
  inputMode: "text" | "numeric";
  placeholder?: string;
  onDone: () => void;
}) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const submitted = useRef(false);

  // Focus (and select) on open so the click that started editing doesn't
  // need a second click to start typing.
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  // Close once the save round-trip finishes, not the moment it's fired.
  useEffect(() => {
    if (submitted.current && !pending) onDone();
  }, [pending, onDone]);

  return (
    <input
      ref={ref}
      name="value"
      type="text"
      inputMode={inputMode}
      defaultValue={defaultValue}
      placeholder={placeholder}
      // Deliberately not disabled while pending: a disabled field is
      // dropped from its own FormData, so if a stray second blur/submit
      // fires mid-flight (browsers reliably force a blur on a field that
      // goes disabled while focused) it would go out with no `value` at
      // all and silently overwrite the real one with blank. A duplicate
      // submit of the *same* value is harmless; a duplicate submit missing
      // the value is data loss.
      className="w-32 rounded border border-brand-600/40 bg-white px-1.5 py-0.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-600/20"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          cancelled.current = true;
          onDone();
        }
        if (e.key === "Enter") {
          e.preventDefault();
          submitted.current = true;
          e.currentTarget.form?.requestSubmit();
        }
      }}
      onBlur={(e) => {
        if (cancelled.current) return;
        submitted.current = true;
        e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
