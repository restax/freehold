"use client";

import { X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Paid-tier CTA while payments are paused: looks identical to the normal
 * plan button but opens a start-free dialog instead of heading to checkout.
 */
export function PaidPlanCta({ label, featured }: { label: string; featured?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`block w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium transition active:scale-[0.98] ${
          featured
            ? "bg-white text-brand-800 hover:bg-brand-50"
            : "bg-stone-900 text-white hover:bg-stone-700"
        }`}
      >
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-stone-900/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-free-title"
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-left shadow-xl"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            >
              <X size={16} weight="bold" />
            </button>
            <h3 id="start-free-title" className="font-display text-lg font-bold text-stone-900">
              Start free today
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Client portals, e-sign, and AI contract extraction, ready in minutes — no credit card
              required.
            </p>
            <Link
              href="/signup"
              className="mt-5 block rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.98]"
            >
              Start free
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
