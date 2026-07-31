"use client";

import { useState } from "react";
import { EntityPicker, type PickerOption } from "@/components/entity-picker";
import { createContactByName } from "@/lib/actions/contacts";
import { btnGhost } from "@/lib/ui";

/**
 * "Link to a contact" on a party that arrived as plain text from contract
 * extraction. Collapsed to a single hover-revealed link by default — most
 * rows never need this, and a picker sitting open on every unlinked party
 * would dominate the card.
 */
export function LinkPartyForm({
  action,
  transactionId,
  role,
  value,
  contacts,
}: {
  action: (formData: FormData) => Promise<void>;
  transactionId: string;
  role: string;
  value: string;
  contacts: PickerOption[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-stone-400 opacity-0 transition hover:text-brand-600 group-hover:opacity-100"
      >
        Link to a contact
      </button>
    );
  }

  return (
    <form
      action={action}
      className="mt-1.5 flex flex-wrap items-end gap-2 rounded-lg bg-stone-50 p-2"
    >
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="value" value={value} />
      <div className="min-w-[13rem] flex-1">
        <EntityPicker
          name="contactId"
          label="Contact"
          options={contacts}
          onCreate={createContactByName}
          createHint="Add contact"
          placeholder={`Search contacts for "${value}"…`}
          autoSubmitOnCreate
        />
      </div>
      <button type="submit" className={btnGhost}>
        Link
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-1 text-xs text-stone-400 hover:text-stone-600"
      >
        Cancel
      </button>
    </form>
  );
}
