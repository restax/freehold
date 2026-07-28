/**
 * Per-client lifecycle-email switches (Client.emailPrefs). Split out of
 * auto-emails.ts, which pulls in next/server and @freehold/db — vitest
 * can't resolve those outside app context, and this function has no
 * dependencies of its own, so it belongs in its own module (the
 * billing-cadence pattern).
 */
export interface ClientEmailPrefs {
  intro?: boolean;
  postClose?: boolean;
  review?: boolean;
}

export function parseEmailPrefs(raw: unknown): Required<ClientEmailPrefs> {
  const c = raw as ClientEmailPrefs | null;
  return {
    intro: c?.intro !== false,
    postClose: c?.postClose !== false,
    review: c?.review !== false,
  };
}
