"use client";

import { useState } from "react";
import { btnGhost, input, label } from "@/lib/ui";
import { MAX_UPLOAD_BYTES, uploadProblem } from "@/lib/upload-limits";

/**
 * The Attachments tab's multi-file upload. Checks sizes in the browser before
 * sending, because the server skips an oversize file without a word and Next
 * rejects an oversize batch before our code sees it. Either way the person got
 * a button that did nothing, or a generic error page.
 */
export function UploadFilesForm({
  action,
  transactionId,
}: {
  action: (formData: FormData) => Promise<void>;
  transactionId: string;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const files = Array.from(
          (e.currentTarget.elements.namedItem("file") as HTMLInputElement).files ?? [],
        );
        const msg = uploadProblem(files);
        if (msg) {
          e.preventDefault();
          setProblem(msg);
        }
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="transactionId" value={transactionId} />
      <label className={`${label} min-w-56 flex-1`}>
        Upload files (PDF, max {MAX_UPLOAD_BYTES / (1024 * 1024)} MB each)
        <input
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          required
          onChange={(e) => setProblem(uploadProblem(Array.from(e.currentTarget.files ?? [])))}
          className={input}
        />
      </label>
      <button type="submit" disabled={problem !== null} className={btnGhost}>
        Upload
      </button>
      <span className="pb-2 text-xs text-stone-400">Each file gets its own row.</span>
      {problem && (
        <p role="alert" className="basis-full text-sm text-red-600">
          {problem}
        </p>
      )}
    </form>
  );
}
