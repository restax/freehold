"use client";

import { FilePdf, Paperclip } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import {
  checkPickedFiles,
  fmtFileSize,
  isImageType,
  MAX_SUPPORT_FILE_BYTES,
  MAX_SUPPORT_FILES,
  SUPPORT_ACCEPT,
} from "@/lib/support-attachments";

/**
 * "Attach screenshots" for a support ticket or reply. A plain file input named
 * `files`, so the surrounding server-action form carries it with no extra
 * wiring. It says "too big" or "wrong kind" at pick time; the server checks the
 * real bytes again, so this is the courtesy, not the enforcement.
 */
export function AttachmentPicker({ compact = false }: { compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // The form clears itself after a send; the list shown here has to follow.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const clear = () => {
      setNames([]);
      setError(null);
    };
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <label
        className={`inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-stone-300 bg-white text-stone-600 hover:border-brand-400 hover:text-brand-700 ${
          compact ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm"
        }`}
      >
        <Paperclip size={compact ? 12 : 14} aria-hidden />
        {names.length > 0 ? "Change files" : "Attach screenshots"}
        <input
          ref={inputRef}
          type="file"
          name="files"
          multiple
          accept={SUPPORT_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            const result = checkPickedFiles(picked);
            if (!result.ok) {
              e.target.value = "";
              setNames([]);
              setError(result.error);
              return;
            }
            setError(null);
            setNames(picked.map((f) => f.name));
          }}
        />
      </label>
      {names.length > 0 && <p className="text-xs text-stone-500">{names.join(", ")}</p>}
      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : (
        names.length === 0 && (
          <p className="text-xs text-stone-400">
            Up to {MAX_SUPPORT_FILES} images or PDFs, {MAX_SUPPORT_FILE_BYTES / (1024 * 1024)} MB
            each.
          </p>
        )
      )}
    </div>
  );
}

export interface AttachmentView {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * The files on a ticket or reply: images as small thumbnails that open full
 * size, PDFs as a named chip. `tenantId` is passed only on the operator's
 * pages, where the file lives in someone else's workspace.
 */
export function AttachmentList({
  attachments,
  tenantId,
}: {
  attachments: AttachmentView[];
  tenantId?: string;
}) {
  if (attachments.length === 0) return null;
  const href = (id: string) =>
    `/api/support-attachments/${id}${tenantId ? `?tenant=${encodeURIComponent(tenantId)}` : ""}`;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) => (
        <li key={a.id}>
          <a
            href={href(a.id)}
            target="_blank"
            rel="noreferrer"
            title={`${a.filename} (${fmtFileSize(a.sizeBytes)})`}
            className="block overflow-hidden rounded-md border border-stone-200 bg-white hover:border-brand-400"
          >
            {isImageType(a.contentType) ? (
              // biome-ignore lint/performance/noImgElement: an authenticated per-file download route, not a static asset next/image can optimise
              <img
                src={href(a.id)}
                alt={a.filename}
                loading="lazy"
                className="h-24 w-auto max-w-56 object-cover"
              />
            ) : (
              <span className="flex items-center gap-2 px-3 py-2 text-xs text-stone-700">
                <FilePdf size={18} className="text-red-600" aria-hidden />
                <span className="max-w-44 truncate">{a.filename}</span>
                <span className="text-stone-400">{fmtFileSize(a.sizeBytes)}</span>
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
