"use client";

import { CircleNotch, Warning } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Badge, type BadgeTone } from "@/components/badges";
import { SIDE_LABEL } from "@/lib/format";
import { btn, btnDanger, card } from "@/lib/ui";

// The pdf.js worker is vendored into /public (copied from pdfjs-dist, kept in
// sync with react-pdf's pinned version) rather than resolved through the
// bundler — Turbopack can't emit it via import.meta.url under pnpm's isolated
// node_modules, and serving it locally keeps everything offline/self-host safe.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const PANE_PADDING = 24; // p-3 on both sides of the scroll container
const MIN_PDF_WIDTH = 360;

const CONF_TONE: Record<string, BadgeTone> = {
  HIGH: "success",
  MEDIUM: "progress",
  LOW: "danger",
};

const TARGET_LABEL: Record<string, string> = {
  TRANSACTION_FIELD: "Updates transaction",
  TASK: "Creates dated task",
  CUSTOM_FIELD: "Saved as custom field",
  PARTY: "Saved as party",
};

const PDF_WIDTH = 540;

export interface ReviewField {
  id: string;
  /** The extractor's field key — "property_address", "close_date", … */
  key: string;
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
  const [pdfWidth, setPdfWidth] = useState(PDF_WIDTH);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<Record<number, HTMLDivElement | null>>({});

  // Render pages at the pane's actual width so the PDF fills the space it has —
  // big on a wide monitor, still fine when the panes stack on mobile.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - PANE_PADDING;
      if (w > 0) setPdfWidth(Math.max(MIN_PDF_WIDTH, w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      {/* Fields — a fixed, comfortable reading column; the PDF takes the rest. */}
      <form action={applyAction} className="flex min-w-0 flex-col gap-4 lg:w-[440px] lg:shrink-0">
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
                    {/* The address is the one extracted value worth correcting
                        in place: contracts abbreviate it ("15 Talmuth"), and
                        every later lookup keys off it. Same picker as manual
                        entry — leave it alone and the model's reading applies
                        unchanged. */}
                    {!readOnly && f.key === "property_address" ? (
                      <span className="min-w-64 flex-1">
                        <AddressAutocomplete
                          name={`value:${f.id}`}
                          defaultValue={f.value}
                          fills={{ city: "addr:city", state: "addr:state", zip: "addr:zip" }}
                        />
                        {/* The picker writes the street line into the field
                            above and the rest here, so correcting the address
                            also corrects the file's city/state/ZIP instead of
                            leaving them pointing at a different town. */}
                        <input type="hidden" name="addr:city" />
                        <input type="hidden" name="addr:state" />
                        <input type="hidden" name="addr:zip" />
                      </span>
                    ) : !readOnly && f.key === "side" ? (
                      /* Derived from the client picked at upload, not read off
                         the page — so it's a choice, not a quote. Blank means
                         nothing matched and the reviewer has to say. */
                      <select
                        name={`value:${f.id}`}
                        defaultValue={f.value}
                        className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm"
                      >
                        <option value="">— pick a side —</option>
                        {Object.entries(SIDE_LABEL).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-stone-700">{f.value}</span>
                    )}
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

      {/* Source PDF — fills the remaining width. */}
      <div className="min-w-0 flex-1">
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
                    width={pdfWidth}
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
