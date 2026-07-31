"use client";

import { PencilSimple } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Inline due-date edit on a task row — same click-to-edit shape as
 * KeyDateRow, scoped to one task instead of the transaction.
 */
export function TaskDueDateField({
  action,
  id,
  transactionId,
  value,
  display,
  overdue,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  transactionId: string;
  /** ISO yyyy-mm-dd, or "" when unset. */
  value: string;
  display: string;
  overdue?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form action={action} className="flex items-center">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="transactionId" value={transactionId} />
        <DateField defaultValue={value} onDone={() => setEditing(false)} />
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Edit due date"
      className={`group flex items-center gap-1 rounded px-1 py-0.5 tabular-nums transition-colors hover:bg-stone-100 ${
        overdue ? "font-medium text-red-600" : "text-stone-500"
      }`}
    >
      {display}
      <PencilSimple
        size={11}
        aria-hidden
        className="text-stone-300 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}

function DateField({ defaultValue, onDone }: { defaultValue: string; onDone: () => void }) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const submitted = useRef(false);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    if (submitted.current && !pending) onDone();
  }, [pending, onDone]);

  return (
    <input
      ref={ref}
      name="value"
      type="date"
      defaultValue={defaultValue}
      className="w-[8.5rem] rounded border border-brand-600/40 bg-white px-1.5 py-0.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-600/20"
      onChange={(e) => {
        submitted.current = true;
        e.currentTarget.form?.requestSubmit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          cancelled.current = true;
          onDone();
        }
      }}
      onBlur={() => {
        if (cancelled.current || submitted.current) return;
        onDone();
      }}
    />
  );
}
