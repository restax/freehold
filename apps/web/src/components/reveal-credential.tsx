"use client";

import { useEffect, useState } from "react";
import { revealCredential } from "@/lib/actions/vault";

/** Reveal-on-click with auto-hide; every click is server-audited. */
export function RevealCredential({ credentialId }: { credentialId: string }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!secret) return;
    const timer = setTimeout(() => setSecret(null), 30_000);
    return () => clearTimeout(timer);
  }, [secret]);

  if (secret) {
    return (
      <span className="inline-flex items-center gap-2">
        <code className="rounded bg-amber-50 px-2 py-0.5 text-xs">{secret}</code>
        <button
          type="button"
          onClick={() => setSecret(null)}
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
          const result = await revealCredential(credentialId);
          if ("error" in result) setError(result.error);
          else setSecret(result.secret);
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
