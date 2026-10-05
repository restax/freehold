/** Client-safe: the upload controls import this to warn before sending. */

/** Per file. uploadDocument enforces the same number on the server. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Per request, all files together. Matches serverActions.bodySizeLimit in
 * next.config.ts; a batch over it is rejected by Next before our code runs, so
 * it has to be caught in the browser to be explained at all.
 */
export const MAX_REQUEST_BYTES = 15 * 1024 * 1024;

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** A plain-language reason these files can't be sent, or null if they can. */
export function uploadProblem(files: Array<{ name: string; size: number }>): string | null {
  const big = files.filter((f) => f.size > MAX_UPLOAD_BYTES);
  if (big.length > 0) {
    const list = big.map((f) => `${f.name} (${mb(f.size)})`).join(", ");
    return `${big.length === 1 ? "This file is" : "These files are"} over the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit: ${list}. Compress or split ${big.length === 1 ? "it" : "them"} and try again.`;
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_REQUEST_BYTES) {
    return `Together these files are ${mb(total)}, and one upload can carry ${MAX_REQUEST_BYTES / (1024 * 1024)} MB. Upload them in smaller groups.`;
  }
  return null;
}
