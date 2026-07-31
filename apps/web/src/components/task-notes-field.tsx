"use client";

import { Check, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Inline notes edit on a task row. Reads as text (or a muted placeholder)
 * until clicked; then a text input with an explicit save/cancel pair —
 * unlike KeyDateRow's date field, a note is free text someone might be
 * mid-thought on, so leaving it on blur would silently discard a draft
 * instead of asking.
 */
export function TaskNotesField({
  action,
  id,
  transactionId,
  notes,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  transactionId: string;
  notes: string | null;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="block w-full truncate rounded px-1 py-0.5 text-left transition-colors hover:bg-stone-100"
        title={notes ?? "Add a note"}
      >
        {notes ? (
          <span className="text-stone-500">{notes}</span>
        ) : (
          <span className="text-stone-300">— add note</span>
        )}
      </button>
    );
  }

  return (
    <NotesForm
      action={action}
      id={id}
      transactionId={transactionId}
      notes={notes}
      onDone={() => setEditing(false)}
    />
  );
}

function NotesForm({
  action,
  id,
  transactionId,
  notes,
  onDone,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  transactionId: string;
  notes: string | null;
  onDone: () => void;
}) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLInputElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    if (submitted.current && !pending) onDone();
  }, [pending, onDone]);

  return (
    <form
      action={action}
      className="flex items-center gap-1"
      onSubmit={() => {
        submitted.current = true;
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <input
        ref={ref}
        name="notes"
        defaultValue={notes ?? ""}
        disabled={pending}
        placeholder="Note…"
        className="w-full rounded border border-brand-600/40 bg-white px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone();
        }}
      />
      <button
        type="submit"
        title="Save"
        disabled={pending}
        className="shrink-0 text-brand-600 hover:text-brand-700"
      >
        <Check size={15} weight="bold" aria-hidden />
      </button>
      <button
        type="button"
        title="Cancel"
        onClick={onDone}
        className="shrink-0 text-stone-400 hover:text-red-600"
      >
        <X size={15} weight="bold" aria-hidden />
      </button>
    </form>
  );
}
