/**
 * Extra phones and emails on a Contact.
 *
 * `Contact.extraContacts` is `{phones: string[], emails: string[]}`, and each
 * entry optionally carries its label inline as a trailing parenthetical —
 * `"214-555-3333 (Voice Mail)"`. That convention was set by the CSV importer
 * (packages/importers), which is where most of these rows come from, so the
 * label lives in the string rather than in a richer shape. Parsing it here
 * rather than changing the stored shape keeps imported rows, the full contact
 * form, and the participant editor all reading the same data.
 *
 * A value with no parenthetical simply has no label; a value that legitimately
 * ends in brackets for another reason (rare, but "(work only after 5)" is the
 * sort of thing people type) round-trips unharmed, because formatting is the
 * exact inverse of parsing.
 */
export interface ContactPoint {
  value: string;
  label: string;
}

const LABELLED = /^(.*?)\s*\(([^()]*)\)$/;

/** `"214-555-3333 (Voice Mail)"` → `{value: "214-555-3333", label: "Voice Mail"}`. */
export function parseContactPoint(raw: string): ContactPoint {
  const trimmed = raw.trim();
  const m = LABELLED.exec(trimmed);
  if (!m) return { value: trimmed, label: "" };
  const [, value, label] = m;
  // "(555) 123-4567" is a phone, not a labelled empty value — a match that
  // leaves nothing in front of the bracket is the format lying to us.
  if (!value.trim()) return { value: trimmed, label: "" };
  return { value: value.trim(), label: label.trim() };
}

/** The inverse: `{value, label}` → the stored string. Empty values drop out. */
export function formatContactPoint(point: ContactPoint): string {
  const value = point.value.trim();
  if (!value) return "";
  const label = point.label.trim();
  return label ? `${value} (${label})` : value;
}

/** Read one side of `extraContacts` into editable rows. */
export function readContactPoints(extra: unknown, key: "phones" | "emails"): ContactPoint[] {
  if (!extra || typeof extra !== "object") return [];
  const list = (extra as Record<string, unknown>)[key];
  if (!Array.isArray(list)) return [];
  return list
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map(parseContactPoint);
}

/**
 * Build the `extraContacts` value from edited rows. Returns null when nothing
 * survives, so an emptied-out form clears the column rather than storing
 * `{phones: [], emails: []}` — a shape every reader would then have to treat
 * as "no extras" anyway.
 */
export function buildExtraContacts(
  phones: ContactPoint[],
  emails: ContactPoint[],
): { phones: string[]; emails: string[] } | null {
  const p = phones.map(formatContactPoint).filter(Boolean);
  const e = emails.map(formatContactPoint).filter(Boolean);
  return p.length || e.length ? { phones: p, emails: e } : null;
}

/** Labels offered in the picker. Free text is still allowed. */
export const CONTACT_POINT_LABELS = ["Mobile", "Home", "Work", "Other"] as const;
