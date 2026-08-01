"use client";

import { useEffect, useState } from "react";

/**
 * "Check all" and a live count for the Attachments bulk bar.
 *
 * The selection itself is plain HTML: every checkbox carries `form="<id>"`,
 * so the bulk buttons submit them without the list having to be wrapped in a
 * form — which it can't be, because each row already contains forms of its
 * own and nested forms are invalid. This component only adds the two things
 * that genuinely need scripting: ticking everything at once, and saying how
 * much is selected before someone zips 40 MB by accident.
 *
 * It reads the DOM rather than owning the state, so the checkboxes stay
 * usable (and the bulk bar stays truthful) even if this never hydrates.
 */
export function BulkSelectSummary({ formId }: { formId: string }) {
  const [count, setCount] = useState(0);
  const [bytes, setBytes] = useState(0);

  const boxes = () =>
    Array.from(
      document.querySelectorAll<HTMLInputElement>(
        `input[type="checkbox"][form="${formId}"][name="rowIds"]`,
      ),
    );

  const recount = () => {
    const picked = boxes().filter((b) => b.checked);
    setCount(picked.length);
    setBytes(picked.reduce((sum, b) => sum + Number(b.dataset.bytes ?? 0), 0));
  };

  useEffect(() => {
    recount();
    // One listener on the document rather than per box: rows come and go with
    // every server render, and re-binding on each would drift.
    const onChange = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t instanceof HTMLInputElement && t.getAttribute("form") === formId) recount();
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  });

  const setAll = (checked: boolean) => {
    for (const b of boxes()) b.checked = checked;
    recount();
  };

  const all = count > 0 && count === boxes().length;

  return (
    <>
      <button
        type="button"
        onClick={() => setAll(!all)}
        className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:border-brand-300 hover:text-brand-700"
      >
        {all ? "Clear all" : "Check all"}
      </button>
      <span className="text-xs tabular-nums text-stone-500">
        {count} selected
        {bytes > 0 && ` · ${(bytes / (1024 * 1024)).toFixed(1)} MB`}
      </span>
    </>
  );
}
