"use client";

import type {} from "@opinly/shared/pixel";

/** Thin wrapper around the Opinly pixel global (loaded in the root layout). No-ops before the script loads. */
export function opinlyIdentify(identity: { email?: string; userId?: string }) {
  window.opinly?.identify(identity);
}

export function opinlyTrack(
  event: string,
  props?: Record<string, unknown>,
  opts?: { externalEventId?: string },
) {
  window.opinly?.track(event, props, opts);
}

/** The pixel's anonymous visitor id, for forwarding to the server on checkout so a later server-side track dedupes against the client-side one. */
export function opinlyAnonId(): string | undefined {
  return window.opinly?.anonId;
}
