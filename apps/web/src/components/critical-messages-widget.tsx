"use client";

import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { useState } from "react";
import { dismissCriticalMessage } from "@/lib/actions/critical-messages";
import type { DueCriticalMessage } from "@/lib/critical-messages-data";

/**
 * The nav-footer broadcast widget. Server-computed which messages are due
 * (see dueCriticalMessagesFor in layout.tsx) — this component only owns the
 * pager and the per-message dismiss, kept in local state for an instant
 * response rather than waiting on a full page revalidation.
 */
export function CriticalMessagesWidget({ messages: initial }: { messages: DueCriticalMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [index, setIndex] = useState(0);

  if (messages.length === 0) return null;
  const at = Math.min(index, messages.length - 1);
  const current = messages[at];

  function dismiss() {
    dismissCriticalMessage(current.id);
    setMessages((prev) => prev.filter((m) => m.id !== current.id));
    setIndex(0);
  }

  return (
    <div
      className={`relative rounded-lg border p-2.5 pr-7 text-xs ${
        current.urgent ? "border-red-300 bg-red-50" : "border-stone-200 bg-white"
      }`}
    >
      <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
        {messages.length > 1 && (
          <span
            role="status"
            aria-label={`${messages.length} messages`}
            className={`inline-flex min-w-4 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-4 ${
              messages.some((m) => m.urgent)
                ? "animate-bounce bg-red-500 text-white"
                : "bg-stone-200 text-stone-600"
            }`}
          >
            {messages.length > 9 ? "9+" : messages.length}
          </span>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
        >
          <X size={12} weight="bold" />
        </button>
      </div>

      <p className="font-medium text-stone-800">{current.title}</p>
      <p className="mt-0.5 line-clamp-3 text-stone-600">{current.body}</p>
      {current.linkUrl && (
        <a
          href={current.linkUrl}
          className="mt-1 inline-block font-medium text-brand-700 hover:underline"
        >
          Go there →
        </a>
      )}

      {messages.length > 1 && (
        <div className="mt-1.5 flex items-center gap-1.5 border-t border-stone-200/70 pt-1.5">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={at === 0}
            aria-label="Previous"
            className="rounded p-0.5 text-stone-500 transition hover:bg-stone-100 disabled:opacity-30"
          >
            <CaretLeft size={11} weight="bold" />
          </button>
          <span className="text-[10px] tabular-nums text-stone-400">
            {at + 1} of {messages.length}
          </span>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(messages.length - 1, i + 1))}
            disabled={at === messages.length - 1}
            aria-label="Next"
            className="rounded p-0.5 text-stone-500 transition hover:bg-stone-100 disabled:opacity-30"
          >
            <CaretRight size={11} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}
