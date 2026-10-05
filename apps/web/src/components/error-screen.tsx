"use client";

import { useEffect } from "react";

/**
 * Shared body of the dashboard and root error pages. Reports the failure once
 * on mount, then tells the person what to quote if they write to us.
 */
export function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        path: window.location.pathname + window.location.search,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 py-16 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-stone-600">
        We have recorded what happened and will look into it. You can try again, and if it keeps
        happening, tell us what you were doing.
      </p>
      {error.digest && <p className="font-mono text-xs text-stone-400">Reference {error.digest}</p>}
      <button
        type="button"
        onClick={reset}
        className="mx-auto rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </div>
  );
}
