"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useFormStatus } from "react-dom";
import { btnGhost } from "@/lib/ui";

/**
 * "Extract contract data" on a document already attached to a transaction.
 *
 * Extraction runs synchronously inside the server action (~30–90s), so a plain
 * submit button looked dead the whole time — the click did nothing visible,
 * then a review page appeared much later out of nowhere. People assumed the
 * button was broken and clicked it again, paying for a second AI run.
 *
 * Same fix already used by ContractUploadForm for the upload-first path; this
 * is the second entry point to the same slow action, which never got it.
 */
export function ExtractButton({
  action,
  documentId,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  documentId: string;
  /** "Extract contract data", or "Extract again" when a run already exists. */
  label: string;
}) {
  return (
    <form action={action}>
      <ExtractSubmit documentId={documentId} label={label} />
    </form>
  );
}

function ExtractSubmit({ documentId, label }: { documentId: string; label: string }) {
  const { pending } = useFormStatus();

  if (pending) {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-lg border border-brand-600/30 bg-white px-2.5 py-1.5 text-xs"
        role="status"
        aria-live="polite"
      >
        <CircleNotch size={14} className="animate-spin text-brand-600" aria-hidden />
        <span className="font-medium text-stone-800">Reading the contract…</span>
        <span className="text-stone-500">up to 90s — keep this tab open</span>
      </span>
    );
  }

  return (
    <>
      <input type="hidden" name="documentId" value={documentId} />
      <button type="submit" className={btnGhost}>
        {label}
      </button>
    </>
  );
}
