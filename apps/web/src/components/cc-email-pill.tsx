"use client";

import { Check, Copy, EnvelopeSimple } from "@phosphor-icons/react";
import { useState } from "react";

/**
 * The workspace CC address shown in the transaction header. Click to copy it to
 * the clipboard — handy when emailing a party from outside Freehold and you
 * want the same address CC'd on every file. Configured under Emails settings.
 */
export function CcEmailPill({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard denied (rare) — nothing to do; the address is still visible.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy CC address"
      className="flex max-w-[16rem] items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-xs transition hover:border-stone-300 hover:bg-stone-50"
    >
      <EnvelopeSimple size={16} className="shrink-0 text-brand-600" aria-hidden />
      <span className="text-stone-400">CC</span>
      <span className="truncate font-medium">{email}</span>
      {copied ? (
        <Check size={15} weight="bold" className="shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <Copy size={15} className="shrink-0 text-stone-400" aria-hidden />
      )}
    </button>
  );
}
