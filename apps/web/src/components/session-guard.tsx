"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

const POLL_MS = 20_000;

/**
 * Mounted once in the dashboard layout. Polls /api/session/status so a
 * concurrent-session kick (see lib/session-limit.ts) surfaces as an explicit
 * modal instead of a silent bounce to /login next time the user clicks
 * something. Skips while the tab is hidden, same pattern as the support
 * unread poller in dashboard-nav.tsx.
 */
export function SessionGuard() {
  const router = useRouter();
  const [kicked, setKicked] = useState<{ upsell: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/session/status", { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = (await res.json()) as { ok: boolean; reason?: string; upsell?: boolean };
        if (!data.ok && data.reason === "superseded") {
          setKicked({ upsell: !!data.upsell });
        }
      } catch {
        // A failed poll just means we try again next tick.
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (!kicked) return null;

  const onSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-kicked-title"
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-left shadow-xl"
      >
        <h3 id="session-kicked-title" className="font-display text-lg font-bold text-stone-900">
          Signed out — new sign-in elsewhere
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          This account just signed in from a different location, so this session was signed out. Pro
          plans support one desktop session at a time (a phone or tablet alongside it is fine) —
          this keeps a paid seat from being shared across an office.
          {kicked.upsell && " Business removes this limit entirely."}
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-5 block w-full rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.98]"
        >
          Sign in again
        </button>
      </div>
    </div>
  );
}
