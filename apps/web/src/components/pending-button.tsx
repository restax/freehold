"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useFormStatus } from "react-dom";

/**
 * A submit button that says something while its server action runs.
 *
 * Server actions in this app are plain form posts, and a plain submit button
 * gives no feedback at all for the whole round trip. On anything slower than
 * instant that reads as a dead control — people click again, which for a paid
 * AI call or an outbound email means doing the work twice.
 *
 * Must be rendered *inside* the <form> whose action it submits: useFormStatus
 * reports on the nearest form above it, so a button that wraps its own form
 * always reads pending=false.
 */
export function PendingButton({
  children,
  pendingLabel,
  className,
  hint,
}: {
  children: React.ReactNode;
  /** What the button says while the action is in flight. */
  pendingLabel: string;
  className: string;
  /** Optional second line for a genuinely slow action ("up to 90s"). */
  hint?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-70`}>
      {pending ? (
        <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
          <CircleNotch size={14} className="animate-spin" aria-hidden />
          {pendingLabel}
          {hint && <span className="font-normal opacity-80">{hint}</span>}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
