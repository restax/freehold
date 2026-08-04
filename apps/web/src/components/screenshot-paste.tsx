"use client";

import { Clipboard } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { btn } from "@/lib/ui";

/**
 * A drop/paste target for a single screenshot, feeding a plain file input so
 * the surrounding form posts as a normal multipart submit with no JS
 * serialization of its own.
 *
 * Paste is the point: a window-level listener means Cmd+V works anywhere on
 * the page without first focusing anything, which is how someone actually
 * uses this — screenshot on one screen, paste on the other. The file input is
 * kept (visually hidden) so the same form still works by clicking to choose a
 * file, and so submission needs no client-side fetch.
 */
export function ScreenshotPaste({ pending }: { pending?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  // Stable identity so the paste listener below isn't torn down and rebound
  // on every render; it only ever touches refs and setState.
  const accept = useCallback((file: File) => {
    // A DataTransfer is the only way to set an <input type=file>'s value.
    const dt = new DataTransfer();
    dt.items.add(file);
    if (inputRef.current) inputRef.current.files = dt.files;
    // No revoking here: state updaters must stay pure (StrictMode invokes
    // them twice), so the effect below owns the object URL's lifetime.
    setPreview(URL.createObjectURL(file));
    setName(file.name || "Pasted screenshot");
  }, []);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (file) {
        e.preventDefault();
        accept(file);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [accept]);

  // Object URLs are per-file; the last one is released when the page unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
          if (file) accept(file);
        }}
        className="flex min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 p-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40"
      >
        {preview ? (
          <>
            {/* biome-ignore lint/performance/noImgElement: a local object URL, not an optimizable asset */}
            <img
              src={preview}
              alt="Pasted screenshot"
              className="max-h-64 rounded border border-stone-200"
            />
            <span className="text-xs text-stone-500">{name} &middot; click to replace</span>
          </>
        ) : (
          <>
            <Clipboard size={22} className="text-stone-400" aria-hidden />
            <span className="text-sm font-medium text-stone-700">
              Paste a screenshot (&#8984;V)
            </span>
            <span className="text-xs text-stone-500">
              or click to choose a file, or drop one here
            </span>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        name="screenshot"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) accept(file);
        }}
      />

      <button type="submit" className={`${btn} self-start`} disabled={!preview || pending}>
        {pending ? "Reading..." : "Read the screenshot"}
      </button>
    </div>
  );
}
