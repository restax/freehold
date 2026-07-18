import { withTenant } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, type BadgeTone } from "@/components/badges";
import { applyExtraction, discardExtraction } from "@/lib/actions/extractions";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btn, btnDanger, card } from "@/lib/ui";

export const dynamic = "force-dynamic";

const CONF_TONE: Record<string, BadgeTone> = {
  HIGH: "success",
  MEDIUM: "progress",
  LOW: "danger",
};

const TARGET_LABEL: Record<string, string> = {
  TRANSACTION_FIELD: "Updates transaction",
  TASK: "Creates dated task",
  CUSTOM_FIELD: "Saved as custom field",
};

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
    <div className="flex max-w-4xl flex-col gap-6">
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
        <form action={applyExtraction} className="flex flex-col gap-4">
          <input type="hidden" name="extractionId" value={extraction.id} />
          <section className={card}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">
                Extracted fields{" "}
                <span className="text-sm font-normal text-stone-400">
                  ({extraction.fields.length} found
                  {lowCount > 0 ? `, ${lowCount} low-confidence unchecked` : ""})
                </span>
              </h2>
            </div>
            <p className="mb-4 text-sm text-stone-500">
              Every value shows the page it came from and the contract language behind it. Uncheck
              anything you don't want; nothing touches the transaction until you apply.
            </p>
            {extraction.fields.length === 0 ? (
              <p className="text-sm text-stone-500">
                The model found no grounded values in this document.
              </p>
            ) : (
              <ul className="flex flex-col">
                {extraction.fields.map((f) => (
                  <li key={f.id} className="border-b border-stone-100 py-3 last:border-0">
                    <div className="flex flex-wrap items-center gap-3">
                      {extraction.status === "READY" ? (
                        <input
                          type="checkbox"
                          name="fieldIds"
                          value={f.id}
                          defaultChecked={f.confidence !== "LOW"}
                          className="h-4 w-4 accent-brand-600"
                        />
                      ) : (
                        <span
                          className={`text-xs ${f.applied ? "text-brand-600" : "text-stone-300"}`}
                        >
                          {f.applied ? "✓ applied" : "skipped"}
                        </span>
                      )}
                      <span className="font-medium">{f.label}</span>
                      <span className="text-stone-700">{f.value}</span>
                      <Badge tone={CONF_TONE[f.confidence] ?? "neutral"}>
                        {f.confidence.toLowerCase()}
                      </Badge>
                      <span className="ml-auto text-xs text-stone-400">
                        {TARGET_LABEL[f.target]}
                        {f.page ? ` · p. ${f.page}` : ""}
                      </span>
                    </div>
                    {f.quote && (
                      <blockquote className="mt-1 border-l-2 border-stone-200 pl-3 text-sm text-stone-500">
                        “{f.quote}”
                      </blockquote>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {extraction.status === "READY" && extraction.fields.length > 0 && (
            <div className="flex items-center gap-3">
              <button type="submit" className={btn}>
                Apply selected to transaction
              </button>
              <button
                type="submit"
                formAction={discardExtraction}
                name="transactionId"
                value={extraction.transactionId}
                className={btnDanger}
              >
                Discard run
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
