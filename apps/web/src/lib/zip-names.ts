/**
 * Naming rules for a downloaded bundle of a transaction's files.
 *
 * Split out from lib/zip.ts so it can be unit-tested: that module reaches
 * storage, which pulls in the S3 client and the vault, and vitest runs
 * without the Next path aliases those use.
 */

/** Strip characters that break archives or filesystems on the way out. */
function safeName(filename: string): string {
  return filename.replace(/[^\w.\- ]/g, "_");
}

/**
 * A filename no earlier entry has taken. Two files genuinely can share a
 * name — a scan and a re-scan both called "disclosure.pdf" — and a zip that
 * silently keeps only the last one loses a document with no warning.
 */
export function uniqueEntryName(filename: string, used: Set<string>): string {
  const base = safeName(filename);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let n = 2;
  let candidate = `${stem} (${n})${ext}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${stem} (${n})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

/**
 * The archive's own name, from the property it belongs to. Punctuation is
 * dropped rather than turned into underscores — an address is full of commas,
 * and "88 Harbor Ln_ Springfield_ IL.zip" looks like something went wrong.
 */
export function zipFilename(propertyAddress: string): string {
  const base =
    propertyAddress
      .replace(/[^\w\- ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60)
      .trim() || "documents";
  return `${base}.zip`;
}
