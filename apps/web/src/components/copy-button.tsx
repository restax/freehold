"use client";

import { useState } from "react";

/** Clipboard copy with a brief "Copied" confirmation. */
export function CopyButton({
  text,
  label = "Copy",
  /** "quiet" sits inside a list of many, where a row of solid buttons shouts. */
  variant = "solid",
}: {
  text: string;
  label?: string;
  variant?: "solid" | "quiet";
}) {
  const [copied, setCopied] = useState(false);
  const base = "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors";
  const skin = copied
    ? "border border-brand-600/30 bg-brand-50 text-brand-700"
    : variant === "quiet"
      ? "border border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50"
      : "bg-brand-700 text-white hover:bg-brand-600";
  return (
    <button
      type="button"
      title="Copy to clipboard"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`${base} ${skin}`}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
