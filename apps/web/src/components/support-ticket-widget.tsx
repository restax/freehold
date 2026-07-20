"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { createTicket } from "@/lib/actions/support";

/**
 * A small "report an issue" box docked in the dashboard sidebar. Deliberately
 * one field — type and send — with the current page carried along
 * automatically so support knows what the person was looking at.
 */
export function SupportTicketWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (sent) {
    return (
      <div className="rounded-lg bg-brand-50 px-2.5 py-2 text-xs text-brand-800">
        Sent — we'll follow up.{" "}
        <a href="/dashboard/support" className="font-medium hover:underline">
          View your tickets →
        </a>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-2.5 py-1.5 text-left text-xs text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
      >
        Report an issue
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        setBusy(true);
        try {
          await createTicket(formData);
          setSent(true);
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-1.5 rounded-lg border border-stone-200 bg-stone-50 p-2"
    >
      <input type="hidden" name="pagePath" value={pathname} />
      <textarea
        name="body"
        required
        rows={3}
        placeholder="What's going wrong?"
        className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-500"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brand-700 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-stone-400 hover:text-stone-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
