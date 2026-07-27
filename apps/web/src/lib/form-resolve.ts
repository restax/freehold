/**
 * Which form a given client sees.
 *
 * A workspace may keep a shared form of a kind and, for particular clients,
 * a private variant of it. The rule is simply: the client's own version wins
 * if there is one, otherwise they get the shared one. A client with no
 * private variant is never left without a form — that fallback is the point,
 * since most clients will never need a bespoke one.
 *
 * Kept pure and dependency-free so the precedence is unit-tested rather than
 * inferred from a query's ORDER BY.
 */

import type { FormLayout } from "./form-schema";

export interface ResolvableForm {
  kind: string;
  status: string;
  showPortal: boolean;
  clientId: string | null;
}

/**
 * The form of `kind` this client should be shown in their portal, or null if
 * the workspace hasn't placed one there. Only published, portal-placed forms
 * are candidates — a draft is invisible to clients however it's addressed.
 */
export function pickFormForClient<T extends ResolvableForm>(
  forms: readonly T[],
  kind: string,
  clientId: string | null,
): T | null {
  const eligible = forms.filter((f) => f.kind === kind && f.status === "published" && f.showPortal);
  const mine = clientId ? eligible.find((f) => f.clientId === clientId) : undefined;
  return mine ?? eligible.find((f) => f.clientId === null) ?? null;
}

/**
 * Every form to show this client, one per kind — so a portal never shows
 * both the shared and the private version of the same thing.
 */
export function portalFormsFor<T extends ResolvableForm>(
  forms: readonly T[],
  clientId: string | null,
): T[] {
  const kinds = [...new Set(forms.map((f) => f.kind))];
  return kinds.map((k) => pickFormForClient(forms, k, clientId)).filter((f): f is T => f !== null);
}

/**
 * Fields a known client shouldn't be asked to fill in again. Their identity
 * is already established by the portal link, so re-asking is friction and an
 * invitation to typos — but only identity is suppressed, never anything
 * about the deal itself.
 */
export const CLIENT_KNOWN_KEYS = [
  "clientName",
  "clientType",
  "email",
  "phone",
  "address",
  "brokerageName",
  "brokeragePhone",
  "brokerageAddress",
  "billingName",
  "billingEmail",
  "billingPhone",
] as const;

export function isClientKnownKey(key: string): boolean {
  return (CLIENT_KNOWN_KEYS as readonly string[]).includes(key);
}

/**
 * The same form with the identity questions removed, ready to show a client
 * we already know — or null when there is nothing left worth showing.
 *
 * Two things have to be dropped, not one. The obvious one is the identity
 * fields. The subtle one is the headings and dividers that introduced them:
 * a "Who should we send invoices to?" heading with nothing underneath reads
 * like a broken page, and a form reduced to headings alone is a Send button
 * that submits nothing.
 */
export function trimKnownClientFields(layout: FormLayout): FormLayout | null {
  const kept = layout.rows
    .map((r) => ({
      ...r,
      cells: r.cells.filter((c) => c.kind !== "field" || !isClientKnownKey(c.key)),
    }))
    .filter((r) => r.cells.length > 0);

  const asksSomething = (r: (typeof kept)[number]) => r.cells.some((c) => c.kind === "field");
  if (!kept.some(asksSomething)) return null;

  // Keep a heading or divider only while a later row still asks something.
  const rows = kept.filter((r, i) => asksSomething(r) || kept.slice(i + 1).some(asksSomething));
  return { rows };
}
