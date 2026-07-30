"use client";

import { useMemo, useState } from "react";
import { EntityPicker, type PickerOption } from "@/components/entity-picker";
import { createContactByName } from "@/lib/actions/contacts";
import { input as inputCls, label as labelCls } from "@/lib/ui";

/**
 * Search contacts by name to fill in an email address, rather than typing
 * the address blind and never knowing whether this vendor already has a
 * record. Picking a contact with an email on file fills it in; picking one
 * without, or adding a new one, leaves the field for the coordinator to type
 * — the send still needs a real address either way, so it stays required and
 * editable regardless of how it got there.
 *
 * Two form fields, one component: `contactId` is informational (nothing
 * downstream reads it today), `email` is what the send action actually uses.
 */
export function ContactEmailField({
  contacts,
  pickerLabel = "Vendor",
  emailLabel = "Vendor email",
  emailFieldName = "email",
  emailPlaceholder = "vendor@example.com",
}: {
  contacts: PickerOption[];
  pickerLabel?: string;
  emailLabel?: string;
  emailFieldName?: string;
  emailPlaceholder?: string;
}) {
  const [email, setEmail] = useState("");
  const byId = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  return (
    <>
      <div className="min-w-[12rem]">
        <EntityPicker
          name="contactId"
          label={pickerLabel}
          options={contacts}
          onCreate={createContactByName}
          createHint="Add contact"
          placeholder="Search contacts…"
          onSelect={(o) => {
            const hint = byId.get(o.id)?.hint;
            if (hint) setEmail(hint);
          }}
        />
      </div>
      <label className={labelCls}>
        {emailLabel}
        <input
          name={emailFieldName}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={emailPlaceholder}
          className={inputCls}
        />
      </label>
    </>
  );
}
