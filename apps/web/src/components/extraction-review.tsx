"use client";

import { CircleNotch, Warning } from "@phosphor-icons/react";
import { useCallback, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { Badge, type BadgeTone } from "@/components/badges";
import { btn, btnDanger, card } from "@/lib/ui";

// The pdf.js worker is vendored into /public (copied from pdfjs-dist, kept in
// sync with react-pdf's pinned version) rather than resolved through the
// bundler — Turbopack can't emit it via import.meta.url under pnpm's isolated
// node_modules, and serving it locally keeps everything offline/self-host safe.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

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

const PDF_WIDTH = 540;

export interface ReviewField {
  id: string;
  label: string;
  value: string;
  confidence: string;
  target: string;
  page: number | null;
  quote: string | null;
  applied: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A text renderer for react-pdf that paints a highlight behind any text item
 * whose words appear in the cited quote. The match is fuzzy on purpose — the
 * model's quote rarely lines up with pdf.js's text spans exactly, so we
 * highlight the overlapping fragments rather than nothing.
 */
function makeHighlighter(quote: string) {
  const normQuote = quote.toLowerCase().replace(/\s+/g, " ").trim();
  return ({ str }: { str: string }) => {
    const frag = str.trim().toLowerCase();
    if (frag.length > 2 && normQuote.includes(frag)) {
      return `<mark class="fh-pdf-hit">${escapeHtml(str)}</mark>`;
    }
    return escapeHtml(str);
  };
}

/**
 * The contract-extraction review, side by side with the source PDF. Hovering a
 * field scrolls the PDF to the page it was cited from and highlights the quoted
 * language, so a coordinator can verify each value against the contract without
 * hunting for it. The apply/discard form keeps working exactly as before —
 * checkboxes select which fields land on the transaction.
 */
export function ExtractionReview({
  documentId,
  status,
  extractionId,
  transactionId,
  fields,
  lowCount,
  applyAction,
  discardAction,
}: {
  documentId: string;
  status: string;
  extractionId: string;
  transactionId: string;
  fields: ReviewField[];
  lowCount: number;
  applyAction: (formData: FormData) => Promise<void>;
  discardAction: (formData: FormData) => Promise<void>;
}) {
  const [numPages, setNumPages] = useState(0);
  const [activePage, setActivePage] = useState<number | null>(null);
  const [activeQuote, setActiveQuote] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<Record<number, HTMLDivElement | null>>({});

  const highlighter = useCallback(
    (page: number) =>
      activePage === page && activeQuote ? makeHighlighter(activeQuote) : undefined,
    [activePage, activeQuote],
  );

  const focusField = (f: ReviewField) => {
    if (!f.page) return;
    setActivePage(f.page);
    setActiveQuote(f.quote);
    const container = scrollRef.current;
    const el = pageEls.current[f.page];
    if (container && el) {
      // Scroll only the PDF pane, never the window: align the page's top to
      // the container's top.
      container.scrollTop += el.getBoundingClientRect().top - container.getBoundingClientRect().top;
    }
  };

  const readOnly = status !== "READY";

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Fields */}
      <form action={applyAction} className="flex min-w-0 flex-1 flex-col gap-4">
        <input type="hidden" name="extractionId" value={extractionId} />
        <section className={card}>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-medium">
              Extracted fields{" "}
              <span className="text-sm font-normal text-stone-400">
                ({fields.length} found
                {lowCount > 0 ? `, ${lowCount} low-confidence unchecked` : ""})
              </span>
            </h2>
          </div>
          <p className="mb-4 text-sm text-stone-500">
            Hover any field to find it in the contract. Uncheck anything you don't want; nothing
            touches the transaction until you apply.
          </p>
          {fields.length === 0 ? (
            <p className="text-sm text-stone-500">
              The model found no grounded values in this document.
            </p>
          ) : (
            <ul className="flex flex-col">
              {fields.map((f) => (
                <li
                  key={f.id}
                  onMouseEnter={() => focusField(f)}
                  className={`-mx-2 cursor-default rounded-md border-b border-stone-100 px-2 py-3 transition-colors last:border-0 ${
                    f.page ? "hover:bg-brand-50/60" : ""
                  } ${activePage != null && f.page === activePage ? "bg-brand-50/60" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    {readOnly ? (
                      <span
                        className={`text-xs ${f.applied ? "text-brand-600" : "text-stone-300"}`}
                      >
                        {f.applied ? "✓ applied" : "skipped"}
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        name="fieldIds"
                        value={f.id}
                        defaultChecked={f.confidence !== "LOW"}
                        className="h-4 w-4 accent-brand-600"
                      />
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

        {!readOnly && fields.length > 0 && (
          <div className="flex items-center gap-3">
            <button type="submit" className={btn}>
              Apply selected to transaction
            </button>
            <button
              type="submit"
              formAction={discardAction}
              name="transactionId"
              value={transactionId}
              className={btnDanger}
            >
              Discard run
            </button>
          </div>
        )}
      </form>

      {/* Source PDF */}
      <div className="shrink-0 lg:w-[560px]">
        <div
          ref={scrollRef}
          className="sticky top-4 max-h-[80vh] overflow-y-auto rounded-xl border border-stone-200 bg-stone-100 p-3 lg:max-h-[calc(100dvh-2rem)]"
        >
          {loadError ? (
            <div className="flex items-center gap-2 p-6 text-sm text-stone-500">
              <Warning size={18} className="text-amber-500" aria-hidden />
              Couldn't render the PDF here.{" "}
              <a
                href={`/api/documents/${documentId}`}
                target="_blank"
                rel="noreferrer"
                className="text-brand-700 underline"
              >
                Open it in a new tab
              </a>
            </div>
          ) : (
            <Document
              file={`/api/documents/${documentId}`}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              onLoadError={() => setLoadError(true)}
              loading={
                <div className="flex items-center justify-center gap-2 p-10 text-sm text-stone-500">
                  <CircleNotch size={18} className="animate-spin text-brand-600" aria-hidden />
                  Loading contract…
                </div>
              }
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                <div
                  key={p}
                  ref={(el) => {
                    pageEls.current[p] = el;
                  }}
                  className={`mb-3 overflow-hidden rounded-md shadow-sm ring-2 transition-shadow last:mb-0 ${
                    activePage === p ? "ring-brand-500" : "ring-transparent"
                  }`}
                >
                  <Page
                    pageNumber={p}
                    width={PDF_WIDTH}
                    customTextRenderer={highlighter(p)}
                    renderAnnotationLayer={false}
                  />
                </div>
              ))}
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
