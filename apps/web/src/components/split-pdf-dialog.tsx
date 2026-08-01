"use client";

import { Plus, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { btn, btnGhost, input, label } from "@/lib/ui";

// Same vendored worker the extraction reviewer uses — see the note there.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface Folder {
  id: string;
  name: string;
}

interface Row {
  key: number;
  name: string;
  from: string;
  to: string;
  folderId: string;
}

/**
 * The submit button, which also closes the dialog once the split has actually
 * run. Splitting is a server round-trip that rewrites the list underneath, so
 * leaving the dialog sitting open over the result reads as "nothing happened";
 * closing before the action returns would be a lie in the other direction.
 *
 * Errors don't need the dialog: a bad set of ranges comes back as a banner on
 * the tab (see splitDocument), because the ranges themselves are usually fine
 * and it's the page count that disagreed.
 */
function SplitButton({ onDone }: { onDone: () => void }) {
  const { pending } = useFormStatus();
  const ran = useRef(false);
  useEffect(() => {
    if (pending) ran.current = true;
    else if (ran.current) {
      ran.current = false;
      onDone();
    }
  }, [pending, onDone]);
  return (
    <button type="submit" disabled={pending} className={`${btn} disabled:opacity-60`}>
      {pending ? "Splitting…" : "Split"}
    </button>
  );
}

/**
 * Carve one PDF into several.
 *
 * The page thumbnails are the point: page ranges typed against a document you
 * can't see are guesses, and a split with the wrong boundary produces files
 * that look right and are wrong. Clicking a page sets it as the boundary of
 * the split you're editing, so the common case — "the addendum starts here" —
 * needs no arithmetic at all.
 *
 * Validation is deliberately *not* duplicated here. The server plans the
 * splits against the real page count (lib/pdf-split.ts) and bounces the whole
 * set back if anything is wrong; a second copy of those rules in the browser
 * would be one more thing to drift.
 */
export function SplitPdfDialog({
  action,
  transactionId,
  documentId,
  filename,
  folders,
}: {
  action: (formData: FormData) => Promise<void>;
  transactionId: string;
  documentId: string;
  filename: string;
  folders: Folder[];
}) {
  const [open, setOpen] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [nextKey, setNextKey] = useState(1);
  const [rows, setRows] = useState<Row[]>([{ key: 0, name: "", from: "1", to: "1", folderId: "" }]);
  // Which split a page click edits, and which end of it comes next.
  const [active, setActive] = useState(0);
  const [edge, setEdge] = useState<"from" | "to">("from");

  const patch = (key: number, part: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...part } : r)));

  const addRow = () => {
    setRows((rs) => [...rs, { key: nextKey, name: "", from: "1", to: "1", folderId: "" }]);
    setActive(nextKey);
    setEdge("from");
    setNextKey((k) => k + 1);
  };

  const pickPage = (page: number) => {
    const row = rows.find((r) => r.key === active) ?? rows[0];
    if (!row) return;
    if (edge === "from") {
      // Dragging the start past the end is a half-finished edit, not an
      // error worth complaining about — carry the end along.
      const to = Number(row.to) < page ? String(page) : row.to;
      patch(row.key, { from: String(page), to });
      setEdge("to");
    } else {
      patch(row.key, { to: String(page) });
      setEdge("from");
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-700 transition-colors hover:text-brand-600"
      >
        Split PDF
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-800">Split {filename}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="ml-auto text-stone-400 transition-colors hover:text-stone-700"
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        </header>

        <form action={action} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="transactionId" value={transactionId} />
          <input type="hidden" name="documentId" value={documentId} />

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:flex-row">
            <div className="flex flex-col gap-3 md:w-1/2">
              {rows.map((row, i) => (
                <fieldset
                  key={row.key}
                  onFocusCapture={() => setActive(row.key)}
                  className={`flex flex-col gap-2 rounded-lg border p-3 transition-colors ${
                    row.key === active ? "border-brand-400 bg-brand-50/40" : "border-stone-200"
                  }`}
                >
                  <legend className="px-1 text-xs font-medium text-stone-500">Split {i + 1}</legend>
                  <span className="flex items-center gap-2">
                    <input
                      name="splitName"
                      value={row.name}
                      onChange={(e) => patch(row.key, { name: e.target.value })}
                      placeholder="Addendum"
                      aria-label={`Name for split ${i + 1}`}
                      className={`${input} flex-1 py-1 text-sm`}
                    />
                    <span className="text-xs text-stone-400">.pdf</span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                        aria-label={`Remove split ${i + 1}`}
                        className="text-stone-300 transition-colors hover:text-red-600"
                      >
                        <X size={14} weight="bold" aria-hidden />
                      </button>
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-1">
                      From
                      <input
                        name="splitFrom"
                        type="number"
                        min={1}
                        value={row.from}
                        onChange={(e) => patch(row.key, { from: e.target.value })}
                        className={`${input} w-16 py-1 text-xs`}
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      To
                      <input
                        name="splitTo"
                        type="number"
                        min={1}
                        value={row.to}
                        onChange={(e) => patch(row.key, { to: e.target.value })}
                        className={`${input} w-16 py-1 text-xs`}
                      />
                    </label>
                    <select
                      name="splitFolder"
                      value={row.folderId}
                      onChange={(e) => patch(row.key, { folderId: e.target.value })}
                      aria-label={`Folder for split ${i + 1}`}
                      className={`${input} flex-1 py-1 text-xs`}
                    >
                      <option value="">No folder</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </span>
                </fieldset>
              ))}

              <button
                type="button"
                onClick={addRow}
                className={`${btnGhost} inline-flex items-center gap-1.5 self-start`}
              >
                <Plus size={14} weight="bold" aria-hidden />
                Add split
              </button>

              <label className={`${label} flex-row items-center gap-2`}>
                <input type="checkbox" name="deleteOriginal" className="h-4 w-4" />
                Delete the original afterwards
              </label>
              <p className="text-xs text-stone-400">
                {rows.length === 1
                  ? "Click a page to set where this split starts, then click again to set where it ends."
                  : `Clicking a page edits split ${
                      rows.findIndex((r) => r.key === active) + 1 || 1
                    } — its ${edge === "from" ? "first" : "last"} page.`}
              </p>
            </div>

            <div className="min-h-0 md:w-1/2">
              <Document
                file={`/api/documents/${documentId}`}
                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                loading={<p className="p-4 text-sm text-stone-400">Loading pages…</p>}
                error={
                  <p className="p-4 text-sm text-stone-500">
                    Couldn't render a preview — you can still type page numbers.
                  </p>
                }
                className="grid grid-cols-3 gap-2"
              >
                {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => {
                  const row = rows.find((r) => r.key === active);
                  const inRange = row && p >= Number(row.from) && p <= Number(row.to);
                  return (
                    <button
                      type="button"
                      key={p}
                      onClick={() => pickPage(p)}
                      aria-label={`Page ${p}`}
                      className={`overflow-hidden rounded border-2 transition-colors ${
                        inRange ? "border-brand-600" : "border-stone-200 hover:border-brand-300"
                      }`}
                    >
                      <Page
                        pageNumber={p}
                        width={110}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                      <span className="block bg-stone-50 py-0.5 text-center text-[10px] text-stone-500">
                        {p}
                      </span>
                    </button>
                  );
                })}
              </Document>
            </div>
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-stone-200 px-4 py-3">
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
              Cancel
            </button>
            <SplitButton onDone={() => setOpen(false)} />
          </footer>
        </form>
      </div>
    </div>
  );
}
