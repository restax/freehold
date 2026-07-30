"use client";

import { useState } from "react";
import { ContactEmailField } from "@/components/contact-email-field";
import type { PickerOption } from "@/components/entity-picker";
import { btn, input, label } from "@/lib/ui";

/**
 * "Email" on a portal link — collapsed to a single button by default, same
 * as the row's other actions. Recipient reuses the vendor-order picker
 * (search a contact by name, or type an address by hand) since a portal
 * link often goes to someone who isn't a saved contact yet.
 */
export function EmailPortalLinkForm({
  action,
  transactionId,
  portalLinkId,
  url,
  contacts,
}: {
  action: (formData: FormData) => Promise<void>;
  transactionId: string;
  portalLinkId: string;
  url: string;
  contacts: PickerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (sent) {
    return <span className="text-xs text-brand-700">Sent</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-stone-500 hover:text-brand-700"
      >
        Email
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        setBusy(true);
        try {
          await action(formData);
          setSent(true);
        } finally {
          setBusy(false);
        }
      }}
      className="mt-2 flex w-full flex-col gap-2 rounded-lg bg-stone-50 p-3"
    >
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="id" value={portalLinkId} />
      <input type="hidden" name="url" value={url} />
      <div className="flex flex-wrap items-end gap-2">
        <ContactEmailField
          contacts={contacts}
          pickerLabel="To"
          emailLabel="Their email"
          emailFieldName="email"
          emailPlaceholder="name@example.com"
        />
      </div>
      <label className={label}>
        Note (optional)
        <textarea
          name="message"
          rows={3}
          placeholder="Add a short note to go with the link…"
          className={input}
        />
      </label>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy} className={`${btn} disabled:opacity-70`}>
          {busy ? "Sending…" : "Send"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-1 text-xs text-stone-400 hover:text-stone-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
