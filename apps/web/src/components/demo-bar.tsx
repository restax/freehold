"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * The strip that says "this is the demo" and gets you back out of it.
 *
 * The watermark alone tells a visitor where they are but gives them nowhere
 * to go: the only exit was the account menu's "Sign out", which reads as
 * something you do to your own account rather than a way to leave a sample
 * workspace you were just looking around.
 *
 * Sticky rather than fixed so it participates in the layout's flex column;
 * the top bar and sidebar shift down by its height through the
 * `--demo-bar` custom property set on the dashboard root, so nothing has to
 * be told about it twice.
 */
export function DemoBar() {
  const [leaving, setLeaving] = useState(false);

  const exit = async () => {
    setLeaving(true);
    try {
      // End the shared visitor session, so the next person to open the demo
      // on this browser starts clean rather than inheriting the tab.
      await authClient.signOut();
    } catch {
      // Leaving matters more than tidying up; a failed sign-out must not
      // strand someone inside the demo.
    }
    window.location.href = "/";
  };

  return (
    <div className="sticky top-0 z-40 flex h-9 shrink-0 items-center gap-3 bg-stone-900 px-3 text-xs text-stone-300 sm:px-4">
      <span className="flex min-w-0 items-center gap-2">
        <span className="rounded bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-900">
          Demo
        </span>
        <span className="truncate">
          You're exploring a sample workspace.{" "}
          <span className="hidden sm:inline">Nothing here is real, and it resets daily.</span>
        </span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1">
        <Link
          href="/"
          className="rounded px-2 py-1 font-medium text-stone-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          Freehold home
        </Link>
        <button
          type="button"
          onClick={exit}
          disabled={leaving}
          className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-60"
        >
          <ArrowLeft size={12} weight="bold" aria-hidden />
          {leaving ? "Leaving…" : "Exit demo"}
        </button>
      </span>
    </div>
  );
}
