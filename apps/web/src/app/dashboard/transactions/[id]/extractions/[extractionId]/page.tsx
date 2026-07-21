import { withTenant } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExtractionReview } from "@/components/extraction-review";
import { applyExtraction, discardExtraction } from "@/lib/actions/extractions";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btnDanger, card } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ExtractionReviewPage({
  params,
}: {
  params: Promise<{ id: string; extractionId: string }>;
}) {
  const { tenantId } = await requireTenant();
  const { id, extractionId } = await params;

  const extraction = await withTenant(tenantId, (tx) =>
    tx.contractExtraction.findUnique({
      where: { id: extractionId },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
        document: { select: { id: true, filename: true } },
        transaction: { select: { id: true, propertyAddress: true } },
      },
    }),
  );
  if (!extraction || extraction.transactionId !== id) notFound();

  const lowCount = extraction.fields.filter((f) => f.confidence === "LOW").length;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/transactions/${extraction.transactionId}`}
          className="text-sm text-stone-500 hover:underline"
        >
          ← {extraction.transaction.propertyAddress}
        </Link>
        <h1 className="text-xl font-semibold">Contract extraction review</h1>
        <p className="text-sm text-stone-500">
          <a
            href={`/api/documents/${extraction.document.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 hover:underline"
          >
            {extraction.document.filename}
          </a>{" "}
          · {fmtDate(extraction.createdAt)} · {extraction.model}
        </p>
      </div>

      {extraction.status === "FAILED" && (
        <section className={card}>
          <h2 className="mb-2 font-medium text-red-700">Extraction failed</h2>
          <p className="text-sm text-stone-600">{extraction.error ?? "Unknown error."}</p>
          <p className="mt-2 text-sm text-stone-500">
            If this mentions authentication, add <code>ANTHROPIC_API_KEY</code> to your{" "}
            <code>.env</code> and try again from the transaction page.
          </p>
          <form action={discardExtraction} className="mt-3">
            <input type="hidden" name="extractionId" value={extraction.id} />
            <input type="hidden" name="transactionId" value={extraction.transactionId} />
            <button type="submit" className={btnDanger}>
              Discard this run
            </button>
          </form>
        </section>
      )}

      {extraction.status !== "FAILED" && (
        <ExtractionReview
          documentId={extraction.document.id}
          status={extraction.status}
          extractionId={extraction.id}
          transactionId={extraction.transactionId}
          lowCount={lowCount}
          applyAction={applyExtraction}
          discardAction={discardExtraction}
          fields={extraction.fields.map((f) => ({
            id: f.id,
            label: f.label,
            value: f.value,
            confidence: f.confidence,
            target: f.target,
            page: f.page,
            quote: f.quote,
            applied: f.applied,
          }))}
        />
      )}
    </div>
  );
}
