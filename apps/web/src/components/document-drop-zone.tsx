"use client";

import { CircleNotch, FilePdf, UploadSimple } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

interface Slot {
  id: string;
  label: string;
}

interface ClassifyResult {
  documentId: string;
  filename: string;
  docType: string | null;
  suggestedRequiredId: string | null;
  missingSlots: Slot[];
}

/**
 * Drag a PDF onto the Documents tab: it uploads, the model guesses what it is
 * and which checklist slot it fills, and a popover lets the coordinator confirm
 * or redirect it before it's filed. The file is saved as soon as it lands — the
 * popover only decides which required-documents slot (if any) it satisfies.
 */
export function DocumentDropZone({
  transactionId,
  linkAction,
}: {
  transactionId: string;
  linkAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [choice, setChoice] = useState<string>("");
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    if (file.type !== "application/pdf") {
      setError("Drop a PDF.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("transactionId", transactionId);
      const res = await fetch("/api/documents/classify", { method: "POST", body });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as ClassifyResult;
      setResult(data);
      setChoice(data.suggestedRequiredId ?? "");
      // The file is on the file now regardless of what happens in the popover.
      router.refresh();
    } catch {
      setError("Upload failed — try again.");
    } finally {
      setUploading(false);
    }
  }

  function confirm() {
    if (!result) return;
    const requiredId = choice;
    if (requiredId) {
      const fd = new FormData();
      fd.set("id", transactionId);
      fd.set("requiredId", requiredId);
      fd.set("documentId", result.documentId);
      startTransition(async () => {
        await linkAction(fd);
        setResult(null);
        router.refresh();
      });
    } else {
      setResult(null);
    }
  }

  // Close the popover on Escape from anywhere.
  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setResult(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result]);

  const suggested = result?.missingSlots.find((s) => s.id === result.suggestedRequiredId);

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target is inherently pointer-driven; the button inside gives keyboard users the same upload path */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragOver ? "border-brand-500 bg-brand-50/60" : "border-stone-300 bg-stone-50"
        }`}
      >
        {uploading ? (
          <>
            <CircleNotch size={26} className="animate-spin text-brand-600" aria-hidden />
            <p className="text-sm text-stone-600">Reading and filing your document…</p>
          </>
        ) : (
          <>
            <UploadSimple size={26} className="text-stone-400" aria-hidden />
            <p className="text-sm text-stone-600">
              Drag a PDF here to file it — we'll figure out what it is and where it goes.
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              or choose a file
            </button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {result && (
        // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop; click-outside and Escape close it, and the dialog content is fully keyboard-usable
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setResult(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="File this document"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-600/10 text-brand-700">
                <FilePdf size={20} weight="fill" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-900">{result.filename}</p>
                <p className="text-xs text-stone-500">
                  {result.docType ? `Looks like: ${result.docType}` : "Uploaded to this file"}
                </p>
              </div>
            </div>

            {result.missingSlots.length > 0 ? (
              <>
                <p className="mb-2 text-sm text-stone-600">
                  {suggested
                    ? `This looks like your "${suggested.label}" — file it there?`
                    : "File it under a checklist item?"}
                </p>
                <select
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                >
                  <option value="">Don't file it under a checklist item</option>
                  {result.missingSlots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-sm text-stone-600">
                It's saved on the file. There are no open checklist slots to file it under.
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                {result.missingSlots.length > 0 ? "Skip" : "Done"}
              </button>
              {result.missingSlots.length > 0 && (
                <button
                  type="button"
                  onClick={confirm}
                  disabled={pending}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
                >
                  {pending ? "Filing…" : choice ? "File it" : "Done"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
