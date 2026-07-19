"use client";

import { useEffect } from "react";

/**
 * Demo entry: a brief signing-you-in moment while /api/demo prepares the
 * shared workspace (self-heal check + session), then a hard navigation so
 * the session cookie applies cleanly.
 */
export default function DemoEntryPage() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.assign("/api/demo");
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200/70 bg-white p-8 text-center shadow-sm">
        <p className="font-display text-lg font-bold text-brand-800">Freehold</p>
        <div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-[3px] border-stone-200 border-t-brand-600" />
        <p className="mt-5 text-sm font-medium text-stone-700">Logging you in to the live demo…</p>
        <p className="mt-1.5 text-xs text-stone-400">Getting the sample workspace ready.</p>
      </div>
    </main>
  );
}
