"use client";

import { useEffect, useState } from "react";
import { revealSkyslope } from "@/lib/actions/skyslope";

/** Reveal-on-click with auto-hide; every click is server-audited. */
export function RevealSkyslope({ clientId }: { clientId: string }) {
  const [creds, setCreds] = useState<{ accessKey: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!creds) return;
    const timer = setTimeout(() => setCreds(null), 30_000);
    return () => clearTimeout(timer);
  }, [creds]);

  if (creds) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <code className="rounded bg-amber-50 px-2 py-0.5 text-xs">key {creds.accessKey}</code>
        <code className="rounded bg-amber-50 px-2 py-0.5 text-xs">secret {creds.secret}</code>
        <button
          type="button"
          onClick={() => setCreds(null)}
          className="text-xs text-stone-400 hover:text-stone-700"
        >
          hide
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await revealSkyslope(clientId);
          if ("error" in result) setError(result.error);
          else setCreds(result);
          setBusy(false);
        }}
        className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 hover:bg-stone-100 disabled:opacity-50"
      >
        {busy ? "Revealing…" : "Reveal (audited)"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
