"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useFormStatus } from "react-dom";
import { btn } from "@/lib/ui";

/**
 * The "Start from a contract" uploader. Extraction runs synchronously inside
 * the server action (~30–90s), so with no pending state the click looked dead —
 * people assumed nothing happened and clicked again. This shows a clear
 * "reading your contract" spinner and disables the controls until the action
 * finishes and redirects to the review page.
 */
export function ContractUploadForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="mt-3">
      <UploadFields />
    </form>
  );
}

function UploadFields() {
  const { pending } = useFormStatus();

  if (pending) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg border border-brand-600/30 bg-white px-4 py-3"
        role="status"
        aria-live="polite"
      >
        <CircleNotch size={20} className="animate-spin text-brand-600" aria-hidden />
        <div>
          <p className="text-sm font-medium text-stone-800">Reading your contract…</p>
          <p className="text-xs text-stone-500">
            This can take up to 90 seconds. Keep this tab open — we'll bring you to the review
            screen automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        name="file"
        type="file"
        accept="application/pdf,.pdf"
        required
        className="text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
      />
      <button type="submit" className={btn}>
        Upload &amp; extract
      </button>
    </div>
  );
}
