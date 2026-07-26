import { withTenant } from "@freehold/db";
import Link from "next/link";
import { Badge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btnGhost, card, input, tableWrap, td, th, trHover } from "@/lib/ui";

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

/**
 * Document library: every file across every transaction in one searchable
 * place. A read/find surface over the same Document rows the Documents tab
 * shows — upload still happens on a transaction (or via the upload-first
 * create flow); this is where they all live together.
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tx?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const { q, tx } = await searchParams;
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

      <section className={card}>
        {documents.length === 0 ? (
          <EmptyState
            title={filtered ? "No documents match" : "No documents yet"}
            hint={
              filtered
                ? "Try a different search, or clear the filters to see everything."
                : "Upload a contract on any transaction — or drop one into “Start from a contract” — and every file lands here."
            }
          />
        ) : (
          <>
            <div className={tableWrap}>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>File</th>
                    <th className={th}>Transaction</th>
                    <th className={th}>Type</th>
                    <th className={th}>Size</th>
                    <th className={th}>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id} className={trHover}>
                      <td className={td}>
                        <span className="flex flex-wrap items-center gap-2">
                          <a
                            href={`/api/documents/${d.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-brand-700 hover:text-brand-600"
                          >
                            {d.filename}
                          </a>
                          {d._count.extractions > 0 && <Badge tone="success">extracted</Badge>}
                        </span>
                      </td>
                      <td className={td}>
                        <Link
                          href={`/dashboard/transactions/${d.transaction.id}`}
                          className="text-brand-700 hover:text-brand-600"
                        >
                          {d.transaction.propertyAddress}
                        </Link>
                      </td>
                      <td className={td}>{typeLabel(d.contentType)}</td>
                      <td className={td}>{fmtSize(d.sizeBytes)}</td>
                      <td className={td}>{fmtDate(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {documents.length === LIMIT && (
              <p className="mt-3 text-xs text-stone-400">
                Showing the most recent {LIMIT}. Narrow with search or a transaction filter to find
                older files.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
