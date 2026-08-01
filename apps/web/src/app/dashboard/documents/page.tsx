import { withTenant } from "@freehold/db";
import { FileArrowDown } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { AddressPill } from "@/components/address-pill";
import { Badge } from "@/components/badges";
import { type DocTreeFolder, DocumentTree } from "@/components/document-tree";
import { EmptyState } from "@/components/empty-state";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btnGhost, card, input } from "@/lib/ui";

export const dynamic = "force-dynamic";

/** "application/pdf" → "PDF"; "image/png" → "PNG"; falls back to the subtype. */
function typeLabel(contentType: string): string {
  const sub = contentType.split("/")[1] ?? contentType;
  const known: Record<string, string> = {
    pdf: "PDF",
    "vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    msword: "DOC",
    png: "PNG",
    jpeg: "JPG",
    jpg: "JPG",
    "octet-stream": "File",
  };
  return known[sub] ?? sub.toUpperCase().slice(0, 8);
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const LIMIT = 300;

/** Iframe-previewable in a plain browser; everything else falls back to a download link. */
function isPreviewable(contentType: string): boolean {
  return contentType === "application/pdf" || contentType.startsWith("image/");
}

/**
 * Document library: every file across every transaction, laid out as a file
 * explorer — folders (transactions) on the left, a preview of the selected
 * file on the right. A read/find surface over the same Document rows the
 * transaction's Attachments tab shows; upload still happens there.
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tx?: string; doc?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const { q, tx, doc: selectedId } = await searchParams;
  const query = (q ?? "").trim();
  const txFilter = (tx ?? "").trim();

  const { documents, transactions } = await withTenant(tenantId, async (t) => ({
    documents: await t.document.findMany({
      where: {
        isCurrent: true,
        ...(txFilter ? { transactionId: txFilter } : {}),
        ...(query ? { filename: { contains: query, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: {
        id: true,
        filename: true,
        contentType: true,
        sizeBytes: true,
        createdAt: true,
        transaction: { select: { id: true, propertyAddress: true } },
        _count: { select: { extractions: true } },
      },
    }),
    transactions: await t.transaction.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, propertyAddress: true },
    }),
  }));

  const filtered = Boolean(query || txFilter);

  const folderOrder: string[] = [];
  const folderMap = new Map<string, DocTreeFolder>();
  for (const d of documents) {
    if (!folderMap.has(d.transaction.id)) {
      folderOrder.push(d.transaction.id);
      folderMap.set(d.transaction.id, {
        transactionId: d.transaction.id,
        propertyAddress: d.transaction.propertyAddress,
        files: [],
      });
    }
    // biome-ignore lint/style/noNonNullAssertion: just set above
    folderMap.get(d.transaction.id)!.files.push({
      id: d.id,
      filename: d.filename,
      contentType: d.contentType,
    });
  }
  const folders = folderOrder.map((id) => folderMap.get(id) as DocTreeFolder);

  const selected = selectedId ? documents.find((d) => d.id === selectedId) : undefined;

  const baseHref = `/dashboard/documents${
    query || txFilter
      ? `?${new URLSearchParams({ ...(query && { q: query }), ...(txFilter && { tx: txFilter }) }).toString()}`
      : ""
  }`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Documents</h1>
        <p className="text-sm text-stone-500">Every file across all your transactions.</p>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by filename…"
          className={`${input} w-56`}
        />
        <select name="tx" defaultValue={txFilter} className={input}>
          <option value="">All transactions</option>
          {transactions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.propertyAddress}
            </option>
          ))}
        </select>
        <button type="submit" className={btnGhost}>
          Filter
        </button>
        {filtered && (
          <Link href="/dashboard/documents" className="text-sm text-stone-500 hover:underline">
            Clear
          </Link>
        )}
      </form>

      {documents.length === 0 ? (
        <section className={card}>
          <EmptyState
            title={filtered ? "No documents match" : "No documents yet"}
            hint={
              filtered
                ? "Try a different search, or clear the filters to see everything."
                : "Upload a contract on any transaction — or drop one into “Start from a contract” — and every file lands here."
            }
          />
        </section>
      ) : (
        <div className="flex gap-6">
          <DocumentTree folders={folders} selectedId={selected?.id} baseHref={baseHref} />

          <div className="min-w-0 flex-1">
            {selected ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <AddressPill
                    href={`/dashboard/transactions/${selected.transaction.id}?tab=documents#doc-${selected.id}`}
                  >
                    {selected.transaction.propertyAddress}
                  </AddressPill>
                  <span className="inline-flex items-center rounded-lg bg-stone-100 px-2.5 py-1 text-sm font-medium text-stone-600">
                    {typeLabel(selected.contentType)}
                  </span>
                  <span className="inline-flex items-center rounded-lg bg-stone-100 px-2.5 py-1 text-sm font-medium text-stone-600">
                    {fmtSize(selected.sizeBytes)}
                  </span>
                  <span className="inline-flex items-center rounded-lg bg-stone-100 px-2.5 py-1 text-sm font-medium text-stone-600">
                    {fmtDate(selected.createdAt)}
                  </span>
                  {selected._count.extractions > 0 && <Badge tone="success">extracted</Badge>}
                  <a
                    href={`/api/documents/${selected.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`${btnGhost} ml-auto gap-1.5`}
                  >
                    <FileArrowDown size={16} aria-hidden />
                    Open
                  </a>
                </div>

                <div className={`${card} overflow-hidden p-0`}>
                  {isPreviewable(selected.contentType) ? (
                    <iframe
                      src={`/api/documents/${selected.id}`}
                      title={selected.filename}
                      className="h-[75vh] w-full"
                    />
                  ) : (
                    <div className="flex h-[75vh] w-full items-center justify-center">
                      <EmptyState
                        title="No preview available"
                        hint={`${selected.filename} can't be previewed in the browser — open it to download instead.`}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <section className={card}>
                <EmptyState
                  title="Pick a file"
                  hint="Choose a document from the folder list on the left to preview it here."
                />
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
