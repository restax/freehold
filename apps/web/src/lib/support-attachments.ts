/**
 * Files sent with a support ticket or one of its replies: screenshots, images
 * and PDFs. Pure rules, no database, so they run identically in the picker
 * (to say no before upload) and in the server action (the enforcement).
 */

/** Per message. Three covers "the error, the page, the result". */
export const MAX_SUPPORT_FILES = 3;

/** Per file. Server actions accept 15 MB in all (next.config), so three
 *  files at this size plus the text always fit. */
export const MAX_SUPPORT_FILE_BYTES = 4 * 1024 * 1024;

export const SUPPORT_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,application/pdf";

export type SupportFileType =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp"
  | "application/pdf";

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/**
 * What a file actually is, from its first bytes. The type the browser reports
 * is just the filename's extension, and the stored type is echoed back when
 * someone opens the file, so a script renamed to .png must not be trusted.
 * Null means "not one of the allowed kinds".
 */
export function sniffSupportType(b: Uint8Array): SupportFileType | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  return null;
}

export function isImageType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

/** "1.2 MB" / "340 KB", for the file chips. */
export function fmtFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * The picker's check, on what the browser knows before upload: how many, how
 * big, and a type that is plausibly allowed. The server re-checks the real
 * bytes; this exists so the person hears "too big" now, not after sending.
 */
export function checkPickedFiles(
  files: Array<{ name: string; size: number; type: string }>,
): { ok: true } | { ok: false; error: string } {
  if (files.length > MAX_SUPPORT_FILES) {
    return { ok: false, error: `Attach up to ${MAX_SUPPORT_FILES} files at a time.` };
  }
  for (const f of files) {
    if (f.size > MAX_SUPPORT_FILE_BYTES) {
      return {
        ok: false,
        error: `${f.name} is over ${MAX_SUPPORT_FILE_BYTES / (1024 * 1024)} MB. Try a smaller screenshot.`,
      };
    }
    if (f.type && !SUPPORT_ACCEPT.split(",").includes(f.type)) {
      return { ok: false, error: `${f.name} isn't an image or PDF.` };
    }
  }
  return { ok: true };
}

/** A name safe to show and to put in a Content-Disposition header. */
export function cleanFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[^\w.\- ]/g, "_")
    .trim()
    .slice(-100);
  return cleaned || "attachment";
}

export interface AcceptedFile {
  filename: string;
  contentType: SupportFileType;
  bytes: Buffer;
}

/**
 * The server's pass over whatever arrived in a form's `files` field: drops
 * empty parts, anything over the limits, and anything whose bytes aren't an
 * allowed type; keeps at most MAX_SUPPORT_FILES. `rejected` names what was
 * dropped so the caller can say so rather than lose a file silently.
 */
export async function acceptSupportFiles(
  entries: FormDataEntryValue[],
): Promise<{ accepted: AcceptedFile[]; rejected: string[] }> {
  const accepted: AcceptedFile[] = [];
  const rejected: string[] = [];
  const files = entries.filter((e): e is File => typeof e !== "string" && e.size > 0);
  for (const file of files) {
    const name = cleanFilename(file.name);
    if (accepted.length >= MAX_SUPPORT_FILES || file.size > MAX_SUPPORT_FILE_BYTES) {
      rejected.push(name);
      continue;
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = sniffSupportType(bytes);
    if (!contentType) {
      rejected.push(name);
      continue;
    }
    accepted.push({ filename: name, contentType, bytes });
  }
  return { accepted, rejected };
}

/** The file extension a sniffed type goes by. */
export function extensionFor(type: SupportFileType): string {
  return type === "application/pdf" ? "pdf" : type === "image/jpeg" ? "jpg" : type.slice(6);
}

/**
 * A neutral name for a file support sends. An operator's screenshot is named
 * by their own machine ("Screenshot 2026-10-04 at 3.12.45 PM.png"), which says
 * nothing useful to the customer and shows how support works, so what they see
 * is just "Screenshot 1.png" or "Attachment 2.pdf".
 */
export function neutralFilename(type: SupportFileType, index: number): string {
  const kind = type === "application/pdf" ? "Attachment" : "Screenshot";
  return `${kind} ${index + 1}.${extensionFor(type)}`;
}
