"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useFormStatus } from "react-dom";
import { btn, input, label } from "@/lib/ui";

/**
 * The "Start from a contract" uploader. Extraction runs synchronously inside
 * the server action (~30–90s), so with no pending state the click looked dead —
 * people assumed nothing happened and clicked again. This shows a clear
 * "reading your contract" spinner and disables the controls until the action
 * finishes and redirects to the review page.
 */
export function ContractUploadForm({
  action,
  clients = [],
}: {
  action: (formData: FormData) => Promise<void>;
  /** Workspace clients, so the file is attached to one at upload. */
  clients?: Array<{ id: string; name: string }>;
}) {
  return (
    <form action={action} className="mt-3">
      <UploadFields clients={clients} />
    </form>
  );
}

function UploadFields({ clients }: { clients: Array<{ id: string; name: string }> }) {
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
    <div className="flex flex-col gap-3">
      {clients.length > 0 && (
        <label className={`${label} max-w-sm`}>
          Whose file is this?
          <select name="clientId" className={input} defaultValue="">
            <option value="">Choose later</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {/* Naming the client is what lets the extractor work out which side
              of the deal is ours: it matches this client (and the agents on
              their roster) against the buyer's agent and listing agent named
              in the contract. Optional, because a brand-new client won't
              exist yet — the side just gets left for you to pick. */}
          <span className="text-xs font-normal text-stone-400">
            Lets us work out which side you're on from the agents named in the contract.
          </span>
        </label>
      )}
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
    </div>
  );
}
