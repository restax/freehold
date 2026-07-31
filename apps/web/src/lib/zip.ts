import JSZip from "jszip";
import { getObjectBytes, type StoredBytes } from "@/lib/storage";
import { uniqueEntryName } from "@/lib/zip-names";

/**
 * Bundling a transaction's files into one download.
 *
 * A lender or a client asks for "everything on the file", and the answer
 * shouldn't be fourteen separate clicks. The coordinator's own download-all
 * and both portals share this, so the archives can't drift into being named
 * or deduped differently depending on who asked.
 */

export interface ZipEntry extends StoredBytes {
  filename: string;
}

/** Decrypt each document and pack it, keeping every file distinguishable. */
export async function buildDocumentZip(docs: ZipEntry[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const doc of docs) {
    const bytes = await getObjectBytes(doc);
    zip.file(uniqueEntryName(doc.filename, used), bytes);
  }
  return zip.generateAsync({ type: "uint8array" });
}

/** The download response, shared so the headers can't drift between callers. */
export function zipResponse(archive: Uint8Array, filename: string): Response {
  return new Response(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
