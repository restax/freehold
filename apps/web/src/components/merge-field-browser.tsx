"use client";

import { useState } from "react";
import type { MergeFieldGroup } from "@/lib/template-merge";

/**
 * Tracks whichever merge-insertable field last had focus, so a click in the
 * browser panel (outside any form field) still knows where to insert. A
 * plain module-level variable is enough — this is single-tab UI state, never
 * read during render, so it doesn't need to be React state anywhere.
 */
let lastFocused: HTMLInputElement | HTMLTextAreaElement | null = null;

export function trackMergeFocus(e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) {
  lastFocused = e.currentTarget;
}

/** Set a field's value the way React notices, even though these fields are
 *  otherwise uncontrolled (defaultValue) — using the native setter first is
 *  what makes React's own change tracking see the update. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function insertCode(code: string) {
  const el = lastFocused;
  const text = `{{${code}}}`;
  if (!el || !document.contains(el)) {
    navigator.clipboard?.writeText(text).catch(() => {});
    return;
  }
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  setNativeValue(el, next);
  el.focus();
  const pos = start + text.length;
  el.setSelectionRange(pos, pos);
}

/**
 * A plain text input that tracks focus for the merge-field browser. Exists
 * because the To/Cc/Subject fields live in a server component (the tab
 * page), and an event handler can only be attached from inside a Client
 * Component boundary.
 */
export function TrackedInput(props: {
  id?: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return <input {...props} onFocus={trackMergeFocus} />;
}

/**
 * The grouped, searchable merge-code panel that sits beside an email
 * template's compose/edit form. Clicking a code inserts it into whichever
 * field was last focused (To, Cc, Subject, or the body editor) — falls back
 * to copying it to the clipboard if nothing's focused.
 */
export function MergeFieldBrowser({ groups }: { groups: MergeFieldGroup[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? groups
        .map((g) => ({ ...g, codes: g.codes.filter((c) => c.toLowerCase().includes(q)) }))
        .filter((g) => g.codes.length > 0)
    : groups;

  return (
    <div className="flex w-64 shrink-0 flex-col gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search merge fields…"
        className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm focus:border-brand-600 focus:outline-none"
      />
      <div className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto">
        {filtered.map((g) => (
          <div key={g.label}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
              {g.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {g.codes.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => insertCode(c)}
                  title={`Insert {{${c}}}`}
                  className="rounded px-1.5 py-1 text-left font-mono text-xs text-stone-600 transition-colors hover:bg-brand-50 hover:text-brand-800"
                >
                  {`{{${c}}}`}
                </button>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-xs text-stone-400">No matching fields.</p>}
      </div>
    </div>
  );
}
