"use client";

import { useEffect } from "react";
import { opinlyTrack } from "@/lib/opinly-pixel";

/**
 * Fires the client-side 'purchase' event on the checkout-return page. Server
 * checkout confirmation (app/api/webhooks/stripe/route.ts) sends the same
 * event with the same externalEventId (the Stripe checkout session id), so
 * Opinly dedupes the two into one — this one covers a lost/delayed webhook,
 * the server one covers an abandoned tab.
 */
export function OpinlyPurchaseTracker({
  sessionId,
  value,
  currency = "USD",
}: {
  sessionId: string;
  value: number;
  currency?: string;
}) {
  useEffect(() => {
    opinlyTrack("purchase", { value, currency }, { externalEventId: sessionId });
  }, [sessionId, value, currency]);

  return null;
}
