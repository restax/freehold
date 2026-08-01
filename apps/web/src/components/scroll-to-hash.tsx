"use client";

import { useEffect } from "react";

/**
 * Scrolls a #doc-<id>-style deep link into view and gives it a brief
 * highlight. Plain CSS `:target` doesn't reapply on Next.js client-side
 * navigation (only on a hard load), so the highlight is done in JS instead,
 * on mount — which fires on every route entry regardless of how we got here.
 */
export function ScrollToHash() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-amber-50");
    const timer = setTimeout(() => el.classList.remove("bg-amber-50"), 2500);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
