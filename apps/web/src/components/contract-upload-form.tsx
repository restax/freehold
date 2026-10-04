"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { NEW_CLIENT_VALUE } from "@/lib/new-client";
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

const KINDS = [
  { value: "purchase", label: "Purchase contract", hint: "An offer or a signed contract" },
  { value: "listing", label: "Listing agreement", hint: "Start from the listing, before an offer" },
] as const;

function UploadFields({ clients }: { clients: Array<{ id: string; name: string }> }) {
  const { pending, data } = useFormStatus();
  // The pending branch replaces the inputs, so what was chosen is read back
  // from the submission rather than from state.
  const submittedKind = data?.get("documentKind");
  const [clientChoice, setClientChoice] = useState("");
  const noun = submittedKind === "listing" ? "listing agreement" : "contract";

  if (pending) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg border border-brand-600/30 bg-white px-4 py-3"
        role="status"
        aria-live="polite"
      >
        <CircleNotch size={20} className="animate-spin text-brand-600" aria-hidden />
        <div>
          <p className="text-sm font-medium text-stone-800">Reading your {noun}…</p>
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
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">What are you uploading?</legend>
        {KINDS.map((k, i) => (
          <label
            key={k.value}
            className="flex min-w-48 cursor-pointer flex-col rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm has-[:checked]:border-brand-600 has-[:checked]:ring-1 has-[:checked]:ring-brand-600"
          >
            <span className="flex items-center gap-2 font-medium text-stone-800">
              <input
                type="radio"
                name="documentKind"
                value={k.value}
                defaultChecked={i === 0}
                className="accent-brand-600"
              />
              {k.label}
            </span>
            <span className="pl-6 text-xs text-stone-500">{k.hint}</span>
          </label>
        ))}
      </fieldset>
      <label className={`${label} max-w-sm`}>
        Whose file is this?
        <select
          name="clientId"
          className={input}
          value={clientChoice}
          onChange={(e) => setClientChoice(e.target.value)}
        >
          <option value="">Choose later</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW_CLIENT_VALUE}>+ Add a new client</option>
        </select>
        {clientChoice === NEW_CLIENT_VALUE && (
          <input
            name="newClientName"
            required
            maxLength={120}
            placeholder="Client name"
            className={input}
          />
        )}
        {/* Naming the client is what lets the extractor work out which side
            of the deal is ours: it matches this client (and the agents on
            their roster) against the buyer's agent and listing agent named
            in the contract. Optional, and a brand-new client can be added
            right here, so the side never has to wait on a trip to Clients. */}
        <span className="text-xs font-normal text-stone-400">
          Lets us work out which side you're on from the agents named in the contract.
        </span>
      </label>
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
