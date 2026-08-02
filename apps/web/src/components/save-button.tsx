"use client";

import { Check, CircleNotch } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * A Save button that tells you where it stands.
 *
 * A plain server-action submit reads as a dead control: you click Save, the
 * page quietly re-renders with the same values, and nothing anywhere says it
 * worked. PendingButton fixes the silence *during* the round trip; this adds
 * the two states either side of it —
 *
 * - **nothing to save** → disabled and dimmed, so the button isn't inviting a
 *   click that would be a no-op
 * - **saved** → says so, briefly, then settles back to disabled
 *
 * and guards the case that actually loses work: edits abandoned by navigating
 * away. Same shape as the website designer's Save, so the two behave alike.
 *
 * Must be rendered *inside* the <form> it submits — useFormStatus reports on
 * the nearest form above it, and the dirty tracking listens to that same form.
 */
export function SaveButton({
  className,
  label = "Save",
  /** What leaving with unsaved edits would cost, in the confirm dialog. */
  confirmMessage = "You have unsaved changes. Leave without saving?",
}: {
  className: string;
  label?: string;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Any edit anywhere in the form arms the button. Listening on the form
  // rather than wiring every field keeps this a drop-in for forms whose
  // inputs stay uncontrolled server-rendered markup.
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const touched = () => {
      setDirty(true);
      setSaved(false);
    };
    form.addEventListener("input", touched);
    form.addEventListener("change", touched);
    return () => {
      form.removeEventListener("input", touched);
      form.removeEventListener("change", touched);
    };
  }, []);

  // pending true → false is the action having finished. There's no success
  // value to read from a void server action, so this transition is the signal.
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    setDirty(false);
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [pending]);

  useEffect(() => {
    if (!dirty) return;

    // Covers reloads, tab closes, and leaving the site. The browser shows its
    // own wording here; the message is not ours to choose.
    const beforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();

    // Covers moving around inside the app, which is the likely way to lose
    // these edits and which beforeunload never sees — client-side navigation
    // doesn't unload the document. Capture phase so this runs before Next's
    // own Link handler has taken over the click.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      // Another origin unloads the document, so beforeUnload already asks.
      if (url.origin !== window.location.origin) return;
      // Same page — an in-page anchor isn't leaving anything behind.
      if (url.pathname === window.location.pathname) return;
      if (!window.confirm(confirmMessage)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, confirmMessage]);

  return (
    <span className="flex items-center gap-3">
      <button
        ref={ref}
        type="submit"
        disabled={pending || !dirty}
        className={`${className} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-700`}
      >
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <CircleNotch size={14} className="animate-spin" aria-hidden />
            Saving…
          </span>
        ) : saved ? (
          <span className="inline-flex items-center gap-1.5">
            <Check size={14} weight="bold" aria-hidden />
            Saved
          </span>
        ) : (
          label
        )}
      </button>
      {/* Announced rather than drawn: the button's own label is the visible
          confirmation, and a second "Saved" beside it would just be noise. */}
      <span className="sr-only" role="status" aria-live="polite">
        {pending ? "Saving" : saved ? "Saved" : ""}
      </span>
      {dirty && !pending && <span className="text-xs text-amber-700">Unsaved changes</span>}
    </span>
  );
}
