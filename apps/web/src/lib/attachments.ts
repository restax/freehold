/**
 * How one Attachments tab is read: what state each row is in, how rows group
 * into folders, and how far along each folder is.
 *
 * Dependency-free and pure so the rules are unit-testable — the counts drive
 * what a coordinator believes about a file ("2 of 9 received"), and a count
 * that quietly disagrees with the rows under it is worse than no count.
 */

/**
 * A row's state, in the order it takes precedence.
 *
 * `omitted` wins over `complete`: a row ruled not-applicable is off the books
 * even if a file was attached before somebody realised. `complete` is
 * independent of whether a file is present — a disclosure signed in person is
 * done with nothing to show, and a file can be attached while the row still
 * waits on a countersignature.
 */
export type AttachmentState = "omitted" | "complete" | "pending";

export interface AttachmentLike {
  completedAt?: Date | string | null;
  omittedAt?: Date | string | null;
  required?: boolean;
  folderId?: string | null;
  sortOrder?: number;
  label?: string;
}

export function attachmentState(row: AttachmentLike): AttachmentState {
  if (row.omittedAt) return "omitted";
  if (row.completedAt) return "complete";
  return "pending";
}

export interface Progress {
  /** Rows that are done. */
  done: number;
  /** Rows that count toward the total — omitted rows are excluded entirely. */
  total: number;
  /** 0-100, rounded. A group with nothing to do reads as 100, not 0. */
  pct: number;
}

/**
 * Progress over a set of rows.
 *
 * Omitted rows leave the denominator rather than counting as done: "3 of 4"
 * where the fourth is N/A should read "3 of 3", not "4 of 4" (which claims
 * work that never happened) and not "3 of 4" (which never reaches complete).
 */
export function progressOf(rows: readonly AttachmentLike[]): Progress {
  let done = 0;
  let total = 0;
  for (const row of rows) {
    const state = attachmentState(row);
    if (state === "omitted") continue;
    total++;
    if (state === "complete") done++;
  }
  return { done, total, pct: total === 0 ? 100 : Math.round((done / total) * 100) };
}

export interface FolderLike {
  id: string;
  name: string;
  sortOrder?: number;
}

export interface AttachmentGroup<T> {
  /** Null for the ungrouped rows that sit under the named folders. */
  folderId: string | null;
  name: string;
  rows: T[];
  progress: Progress;
}

/** Label for rows that belong to no folder. */
export const UNGROUPED_LABEL = "Ungrouped";

/**
 * Group rows into their folders, in folder order, with ungrouped rows last.
 *
 * Empty folders are kept: a folder you made and haven't filled is a statement
 * that something is expected there, and hiding it until the first file lands
 * makes the tab look like it forgot. Rows pointing at a folder that no longer
 * exists fall back to ungrouped rather than vanishing.
 */
export function groupAttachments<T extends AttachmentLike>(
  rows: readonly T[],
  folders: readonly FolderLike[],
): AttachmentGroup<T>[] {
  const ordered = [...folders].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
  );
  const known = new Set(ordered.map((f) => f.id));
  const byFolder = new Map<string | null, T[]>();
  for (const f of ordered) byFolder.set(f.id, []);

  const sorted = [...rows].sort(
    (a, b) =>
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.label ?? "").localeCompare(b.label ?? ""),
  );
  for (const row of sorted) {
    const key = row.folderId && known.has(row.folderId) ? row.folderId : null;
    const bucket = byFolder.get(key);
    if (bucket) bucket.push(row);
    else byFolder.set(key, [row]);
  }

  const groups: AttachmentGroup<T>[] = ordered.map((f) => {
    const rowsIn = byFolder.get(f.id) ?? [];
    return { folderId: f.id, name: f.name, rows: rowsIn, progress: progressOf(rowsIn) };
  });

  const loose = byFolder.get(null) ?? [];
  if (loose.length > 0) {
    groups.push({
      folderId: null,
      name: UNGROUPED_LABEL,
      rows: loose,
      progress: progressOf(loose),
    });
  }
  return groups;
}
