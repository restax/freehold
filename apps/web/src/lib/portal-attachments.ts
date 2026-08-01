/**
 * What a client is shown on the Files section of their portal.
 *
 * Two separate questions, deliberately answered by two different flags:
 *
 *   * a row that **holds a document** is shown when that *document* is
 *     `visibleToClient` — the rule the portal has always used, and the one
 *     coordinators already understand from the per-file toggles;
 *   * a row the file is still **waiting on** is shown only when the *row* is
 *     `visibleToClient`, which is off by default.
 *
 * Keeping them separate is the point. Sharing a document is a decision about
 * a thing that exists; telling a client what's outstanding is a decision
 * about internal process, and a checklist written for the coordinator
 * ("Seller's disclosure — chase Dana") is not client-facing copy.
 *
 * Omitted rows never appear either way: "not applicable to this deal" is a
 * conclusion the coordinator reached, not something the client is waiting on.
 */

export interface PortalRow {
  id: string;
  label: string;
  folderId?: string | null;
  sortOrder?: number;
  completedAt?: Date | string | null;
  omittedAt?: Date | string | null;
  visibleToClient?: boolean;
  document?: {
    id: string;
    filename: string;
    sizeBytes: number;
    visibleToClient?: boolean;
    visibleToAgent?: boolean;
  } | null;
}

export interface PortalFolder {
  id: string;
  name: string;
  sortOrder?: number;
}

/** A row as the portal renders it: either a file to open, or a thing awaited. */
export interface PortalItem {
  id: string;
  label: string;
  document: { id: string; filename: string; sizeBytes: number } | null;
}

export interface PortalGroup {
  folderId: string | null;
  name: string;
  shared: PortalItem[];
  /** Outstanding rows the coordinator chose to surface. */
  awaiting: PortalItem[];
}

export const PORTAL_UNGROUPED = "Files";

/**
 * Which portal is asking. Documents already carry a separate flag per
 * audience (`visibleToClient` / `visibleToAgent`), and this keeps that
 * distinction instead of collapsing the two portals into one rule.
 */
export type PortalAudience = "client" | "agent";

/** Should this audience see the row at all, and in which of the two lists? */
export function portalVisibility(
  row: PortalRow,
  audience: PortalAudience = "client",
): "shared" | "awaiting" | "hidden" {
  if (row.omittedAt) return "hidden";
  if (row.document) {
    const flag = audience === "agent" ? row.document.visibleToAgent : row.document.visibleToClient;
    return flag === false ? "hidden" : "shared";
  }
  // "Still needed" is only ever offered to clients: the opt-in is literally
  // a decision about what to tell the client, and quietly reusing it to
  // publish the checklist to agents too would be a different decision the
  // coordinator never made.
  return audience === "client" && row.visibleToClient ? "awaiting" : "hidden";
}

/**
 * Group what the client may see into folders, dropping folders that end up
 * with nothing in them — an empty "Contract" heading tells a client only that
 * there is something they aren't being shown.
 */
export function portalGroups(
  rows: readonly PortalRow[],
  folders: readonly PortalFolder[],
  audience: PortalAudience = "client",
): PortalGroup[] {
  const ordered = [...folders].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
  );
  const known = new Map(ordered.map((f) => [f.id, f.name]));
  const buckets = new Map<string | null, PortalGroup>();
  const groupFor = (key: string | null): PortalGroup => {
    const existing = buckets.get(key);
    if (existing) return existing;
    const made: PortalGroup = {
      folderId: key,
      name: key ? (known.get(key) ?? PORTAL_UNGROUPED) : PORTAL_UNGROUPED,
      shared: [],
      awaiting: [],
    };
    buckets.set(key, made);
    return made;
  };

  const sorted = [...rows].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label),
  );
  for (const row of sorted) {
    const where = portalVisibility(row, audience);
    if (where === "hidden") continue;
    const key = row.folderId && known.has(row.folderId) ? row.folderId : null;
    const item: PortalItem = {
      id: row.id,
      label: row.label,
      document: row.document
        ? {
            id: row.document.id,
            filename: row.document.filename,
            sizeBytes: row.document.sizeBytes,
          }
        : null,
    };
    groupFor(key)[where === "shared" ? "shared" : "awaiting"].push(item);
  }

  // Named folders first in their own order, loose files last.
  const out: PortalGroup[] = [];
  for (const f of ordered) {
    const g = buckets.get(f.id);
    if (g && (g.shared.length > 0 || g.awaiting.length > 0)) out.push(g);
  }
  const loose = buckets.get(null);
  if (loose && (loose.shared.length > 0 || loose.awaiting.length > 0)) out.push(loose);
  return out;
}

/** Every document id the client may open, for the portal's zip. */
export function portalDocumentIds(
  rows: readonly PortalRow[],
  audience: PortalAudience = "client",
): string[] {
  return rows
    .filter((r) => portalVisibility(r, audience) === "shared" && r.document)
    .map((r) => r.document?.id)
    .filter((v): v is string => Boolean(v));
}
