/**
 * Working out which pages go into which new file when a PDF is split.
 *
 * Pure and dependency-free so the arithmetic is unit-testable: a range that is
 * silently wrong produces a file that looks plausible and contains the wrong
 * pages, which is worse than an error — nobody re-reads a document they just
 * split successfully.
 *
 * Page numbers are 1-based everywhere a person sees them (the dialog, the
 * errors) and converted to 0-based only at the pdf-lib boundary.
 */

export interface SplitSpec {
  /** Filename for the new document, without the .pdf suffix. */
  name: string;
  /** 1-based, inclusive. */
  from: number;
  to: number;
  /** Attachment folder the resulting row is filed into, if any. */
  folderId?: string | null;
}

export interface PlannedSplit extends SplitSpec {
  /** 0-based page indices for pdf-lib's copyPages. */
  pageIndices: number[];
}

export interface SplitPlan {
  splits: PlannedSplit[];
  errors: string[];
}

/** The filename a split produces, always ending in exactly one ".pdf". */
export function splitFilename(name: string): string {
  const trimmed = name.trim().replace(/\.pdf$/i, "");
  const safe = trimmed || "split";
  return `${safe}.pdf`;
}

/**
 * Validate a set of splits against the source document's real page count.
 *
 * Returns every problem rather than the first, so a dialog with four ranges in
 * it reports all four at once instead of making the person resubmit to find
 * the next one. A plan with any errors produces no splits at all — a partial
 * split leaves the source half-carved with no record of what was intended.
 */
export function planSplits(specs: readonly SplitSpec[], pageCount: number): SplitPlan {
  const errors: string[] = [];
  const splits: PlannedSplit[] = [];

  if (specs.length === 0) errors.push("Add at least one split.");
  if (pageCount < 1) errors.push("That PDF has no pages to split.");

  const seenNames = new Set<string>();
  specs.forEach((spec, i) => {
    const where = `Split ${i + 1}`;
    const from = Math.trunc(spec.from);
    const to = Math.trunc(spec.to);

    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < 1) {
      errors.push(`${where}: page numbers start at 1.`);
      return;
    }
    if (from > to) {
      errors.push(`${where}: “from” page ${from} is after “to” page ${to}.`);
      return;
    }
    if (pageCount >= 1 && to > pageCount) {
      errors.push(`${where}: page ${to} is past the end (${pageCount} pages).`);
      return;
    }

    const filename = splitFilename(spec.name);
    const key = filename.toLowerCase();
    if (seenNames.has(key)) {
      // Two splits writing the same name is almost always a half-finished
      // edit, and the second would land as an indistinguishable duplicate.
      errors.push(`${where}: “${filename}” is already used by another split.`);
      return;
    }
    seenNames.add(key);

    splits.push({
      name: spec.name,
      from,
      to,
      folderId: spec.folderId ?? null,
      pageIndices: Array.from({ length: to - from + 1 }, (_, n) => from - 1 + n),
    });
  });

  return { splits: errors.length > 0 ? [] : splits, errors };
}

/**
 * Pages of the source that no split claims.
 *
 * Offered as a warning rather than an error: dropping the cover sheet and the
 * blank back page is a normal thing to want. It only matters because deleting
 * the original afterwards would take those pages with it.
 */
export function unclaimedPages(splits: readonly PlannedSplit[], pageCount: number): number[] {
  const claimed = new Set(splits.flatMap((s) => s.pageIndices));
  const out: number[] = [];
  for (let i = 0; i < pageCount; i++) if (!claimed.has(i)) out.push(i + 1);
  return out;
}
