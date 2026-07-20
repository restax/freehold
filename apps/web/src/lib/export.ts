import { withTenant } from "@freehold/db";
import JSZip from "jszip";
import { getObjectBytes } from "@/lib/storage";

/**
 * Client-owned data export: a single ZIP a workspace can take anywhere — its
 * full records as JSON plus the actual document files, decrypted and usable.
 * Powers the on-demand "download my data" button and the nightly push to a
 * tenant's own storage. The point is portability: even if Freehold Cloud
 * vanished, this archive + the open-source repo is a working copy of the
 * business.
 */

// Guard against unbounded memory on huge workspaces; documents beyond this are
// listed in the manifest but not embedded (the JSON still names them).
const MAX_DOC_BYTES = 200 * 1024 * 1024;

function safe(name: string): string {
  return name.replace(/[^\w.\- ]/g, "_").slice(0, 80) || "untitled";
}

export interface ExportResult {
  zip: Uint8Array;
  filename: string;
  transactionCount: number;
  documentCount: number;
  documentsTruncated: boolean;
}

export async function buildWorkspaceExport(tenantId: string): Promise<ExportResult> {
  const data = await withTenant(tenantId, async (tx) => {
    const [transactions, contacts, clients] = await Promise.all([
      tx.transaction.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          parties: { include: { contact: { select: { name: true, email: true, phone: true } } } },
          tasks: { orderBy: { dueDate: "asc" } },
          documents: {
            select: {
              id: true,
              filename: true,
              contentType: true,
              sizeBytes: true,
              storageKey: true,
              data: true,
              storageProvider: true,
              tenantId: true,
              createdAt: true,
              version: true,
              isCurrent: true,
            },
          },
        },
      }),
      tx.contact.findMany({ orderBy: { createdAt: "asc" } }),
      tx.client.findMany({ orderBy: { createdAt: "asc" } }),
    ]);
    return { transactions, contacts, clients };
  });

  const zip = new JSZip();

  // Structured records. Document bytes are stripped from the JSON — they ride
  // as real files under documents/ — but the manifest keeps every filename.
  const jsonSafe = {
    exportedAt: new Date().toISOString(),
    generator: "Freehold — source-available at https://github.com/restax/freehold",
    transactions: data.transactions.map((t) => ({
      ...t,
      documents: t.documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        contentType: d.contentType,
        sizeBytes: d.sizeBytes,
        createdAt: d.createdAt,
        // biome-ignore lint/suspicious/noExplicitAny: stripping raw bytes for the JSON view
        data: undefined as any,
        storageKey: undefined as unknown as string,
      })),
    })),
    contacts: data.contacts,
    clients: data.clients,
  };
  zip.file("freehold-export.json", JSON.stringify(jsonSafe, null, 2));

  // The actual files, decrypted, grouped by transaction.
  let documentCount = 0;
  let totalBytes = 0;
  let documentsTruncated = false;
  for (const t of data.transactions) {
    for (const d of t.documents) {
      if (totalBytes + d.sizeBytes > MAX_DOC_BYTES) {
        documentsTruncated = true;
        continue;
      }
      try {
        const bytes = await getObjectBytes(d);
        // Current files land at the top; superseded versions go in a
        // prior-versions/ subfolder so identically named files never collide.
        const dir = `documents/${safe(t.propertyAddress)}`;
        const path = d.isCurrent
          ? `${dir}/${safe(d.filename)}`
          : `${dir}/prior-versions/v${d.version}-${safe(d.filename)}`;
        zip.file(path, bytes);
        documentCount += 1;
        totalBytes += bytes.length;
      } catch {
        // A single unreadable file (e.g. a disconnected tenant bucket) never
        // sinks the whole export — the manifest still records it.
        documentsTruncated = true;
      }
    }
  }

  zip.file(
    "README.txt",
    [
      "This is a complete export of your Freehold workspace.",
      "",
      "  freehold-export.json   All records: transactions, contacts, clients,",
      "                         parties, tasks, and a manifest of every document.",
      "  documents/             The actual files, one folder per property.",
      "",
      "Freehold is source-available software (Elastic License 2.0). The full",
      "application is public at https://github.com/restax/freehold — you can run",
      "it for your own organization, free, forever. This archive plus that repo",
      "is a working copy of your business that never depends on us.",
      documentsTruncated
        ? "\nNote: some documents were too large to embed or couldn't be read; every file is still named in the JSON manifest."
        : "",
    ].join("\n"),
  );

  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    zip: zipBytes,
    filename: `freehold-export-${stamp}.zip`,
    transactionCount: data.transactions.length,
    documentCount,
    documentsTruncated,
  };
}
