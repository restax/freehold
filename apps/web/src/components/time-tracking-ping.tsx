"use client";

import { useEffect } from "react";
import { PING_INTERVAL_MS } from "@/lib/time-tracking";

/**
 * The invisible half of "time on files": while a transaction page is open
 * and the tab is visible, ping once a minute so the ledger accrues. Renders
 * nothing, fails silently — a blocked or failed ping must never affect the
 * page it's riding on. The server dedupes, so an extra ping (remount,
 * visibility flap) is harmless.
 */
export function TimeTrackingPing({ transactionId }: { transactionId: string }) {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/time/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
        keepalive: true,
      }).catch(() => {});
    };

    ping();
    const timer = setInterval(ping, PING_INTERVAL_MS);
    // Coming back to a backgrounded tab counts as picking the file back up.
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [transactionId]);

  return null;
}
