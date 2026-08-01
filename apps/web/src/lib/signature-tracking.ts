/**
 * Lightweight "who has signed this" tracking on an attachment row.
 *
 * Deliberately not e-signature: Documenso already does that, and most documents
 * on a file are signed somewhere else entirely — in person, in the agent's own
 * DocuSign, on paper at the title company. What a coordinator actually needs is
 * a place to record what they already know, so "waiting on the seller" is
 * visible on the row instead of living in their head.
 *
 * State is keyed by **party id**, not by role. Two buyers are two signatures,
 * and a role-keyed map would silently merge them into one. The cost is that
 * removing a party leaves an orphaned entry, which `signatureProgress` and
 * `pruneSignatures` handle by ignoring anything that isn't a current signer —
 * self-healing, rather than needing a cleanup pass on every party edit.
 */

/** Party roles that plausibly sign a transaction document. */
export const SIGNING_ROLES = ["BUYER", "SELLER", "BUYER_AGENT", "LISTING_AGENT"] as const;

/** Compact pill labels — a row can carry four of these and stay readable. */
export const ROLE_ABBR: Record<string, string> = {
  BUYER: "B",
  SELLER: "S",
  BUYER_AGENT: "BA",
  LISTING_AGENT: "LA",
};

/** partyId → ISO timestamp of when that party signed. */
export type SignatureState = Record<string, string>;

export interface SignerParty {
  id: string;
  role: string;
  contact?: { name?: string | null } | null;
}

/** Order pills settle into, regardless of how the parties were entered. */
const ROLE_ORDER = new Map(SIGNING_ROLES.map((r, i) => [r as string, i]));

/**
 * Read the JSON column defensively. Anything that isn't a string-to-string map
 * is treated as absent rather than trusted — the column is `Json?` and nothing
 * stops an older shape, or hand-edited data, from being in there.
 */
export function readSignatureState(value: unknown): SignatureState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: SignatureState = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** Whether this row is tracking signatures at all (an empty map still is). */
export function isTracking(value: unknown): boolean {
  return readSignatureState(value) !== null;
}

/**
 * The parties who get a pill: those on the file in a signing role, in a stable
 * order. A listing-side file with no buyer's agent shows no BA pill rather
 * than an empty one nobody can ever tick.
 */
export function signerParties<T extends SignerParty>(parties: readonly T[]): T[] {
  return parties
    .filter((p) => ROLE_ORDER.has(p.role))
    .sort(
      (a, b) =>
        (ROLE_ORDER.get(a.role) ?? 99) - (ROLE_ORDER.get(b.role) ?? 99) ||
        (a.contact?.name ?? "").localeCompare(b.contact?.name ?? ""),
    );
}

export interface SignatureProgress {
  signed: number;
  total: number;
  /** True only when there is someone to sign and everyone has. */
  complete: boolean;
}

export function signatureProgress(
  state: SignatureState | null,
  signers: readonly SignerParty[],
): SignatureProgress {
  const total = signers.length;
  if (!state || total === 0) return { signed: 0, total, complete: false };
  const signed = signers.filter((p) => state[p.id]).length;
  return { signed, total, complete: signed === total };
}

/** Tick or untick one party. Returns a new map; never mutates. */
export function toggleSigner(
  state: SignatureState | null,
  partyId: string,
  now: Date = new Date(),
): SignatureState {
  const next = { ...(state ?? {}) };
  if (next[partyId]) delete next[partyId];
  else next[partyId] = now.toISOString();
  return next;
}

/**
 * Mark everyone signed at once — the "executed" shortcut for a document that
 * came back fully signed, which is the common case and otherwise four clicks.
 * Already-signed parties keep their original timestamp rather than being
 * restamped to now.
 */
export function signAll(
  state: SignatureState | null,
  signers: readonly SignerParty[],
  now: Date = new Date(),
): SignatureState {
  const next = { ...(state ?? {}) };
  for (const p of signers) if (!next[p.id]) next[p.id] = now.toISOString();
  return next;
}

/** Drop entries for parties who are no longer on the file. */
export function pruneSignatures(
  state: SignatureState | null,
  signers: readonly SignerParty[],
): SignatureState {
  if (!state) return {};
  const live = new Set(signers.map((p) => p.id));
  return Object.fromEntries(Object.entries(state).filter(([id]) => live.has(id)));
}
