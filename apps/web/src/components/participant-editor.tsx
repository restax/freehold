"use client";

import { Buildings, Envelope, PencilSimple, Phone, Plus, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { PhoneInput } from "@/components/phone-input";
import { CONTACT_POINT_LABELS, type ContactPoint } from "@/lib/contact-points";
import { btn, btnGhost, input, label as labelCls, td } from "@/lib/ui";

/** One line of the read-only "seen on these emails" list. */
export interface ParticipantEmail {
  id: string;
  subject: string;
  direction: string;
  createdAt: string;
}

export interface ParticipantContact {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  extraPhones: ContactPoint[];
  extraEmails: ContactPoint[];
}

/** Closes the dialog once the action has actually run, not on click. */
function SaveButton({ onDone, children }: { onDone: () => void; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  const ran = useRef(false);
  useEffect(() => {
    if (pending) ran.current = true;
    else if (ran.current) {
      ran.current = false;
      onDone();
    }
  }, [pending, onDone]);
  return (
    <button type="submit" disabled={pending} className={`${btn} disabled:opacity-60`}>
      {pending ? "Saving…" : children}
    </button>
  );
}

/**
 * Editable list of extra phones or emails, each with a label chosen from a
 * fixed set.
 *
 * The label is a closed list rather than free text, so "Mobile"/"mobile"/"cell"
 * don't all end up meaning the same thing across a workspace. The one
 * concession: a label already on the record that isn't in the list — the CSV
 * importer happily writes things like "Voice Mail" or "His Home Line" — is
 * offered as its own option, so opening an imported contact and pressing Save
 * can never quietly rewrite what somebody's data already said.
 */
function PointRows({
  rows,
  setRows,
  name,
  kind,
  addLabel,
}: {
  rows: ContactPoint[];
  setRows: (next: ContactPoint[]) => void;
  name: "extraPhone" | "extraEmail";
  kind: "phone" | "email";
  addLabel: string;
}) {
  const patch = (i: number, next: Partial<ContactPoint>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...next } : r)));

  return (
    <div className="flex flex-col gap-2">
      {/* An empty list still submits the field name, so the server can tell
          "removed them all" apart from "this form doesn't edit extras". */}
      {rows.length === 0 && <input type="hidden" name={name} value="" />}
      {rows.map((row, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and have no stable id until saved
        <div key={i} className="flex items-center gap-2">
          {kind === "phone" ? (
            <PhoneInput
              name={name}
              value={row.value}
              onChange={(e) => patch(i, { value: e.currentTarget.value })}
              aria-label={`Additional phone ${i + 1}`}
              className={`${input} flex-1`}
            />
          ) : (
            <input
              type="email"
              name={name}
              value={row.value}
              onChange={(e) => patch(i, { value: e.currentTarget.value })}
              aria-label={`Additional email ${i + 1}`}
              className={`${input} flex-1`}
            />
          )}
          <select
            name={`${name}Label`}
            value={row.label}
            onChange={(e) => patch(i, { label: e.currentTarget.value })}
            aria-label={`Label for ${kind} ${i + 1}`}
            className={`${input} w-28 shrink-0`}
          >
            <option value="">No label</option>
            {CONTACT_POINT_LABELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
            {/* Whatever was already stored, when it predates this list. */}
            {row.label && !CONTACT_POINT_LABELS.some((l) => l === row.label) && (
              <option value={row.label}>{row.label}</option>
            )}
          </select>
          <button
            type="button"
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
            aria-label={`Remove ${kind} ${i + 1}`}
            className="shrink-0 text-stone-300 transition-colors hover:text-red-600"
          >
            <X size={14} weight="bold" aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, { value: "", label: "" }])}
        className="flex w-fit items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-600"
      >
        <Plus size={11} weight="bold" aria-hidden />
        {addLabel}
      </button>
    </div>
  );
}

/**
 * The whole editable half of a participant row: name, company, phone, email —
 * plus the dialog behind the name for a one-off party.
 *
 * Two ways in, because they answer different questions. The three cells edit
 * in place for the constant case ("they gave me a better number"), and the
 * dialog opens the fuller — still small — form for everything else. Neither
 * route reaches the full contact record: a buyer or seller is typically
 * entered once and never again, so sending someone to the CRM screen with its
 * addresses, categories, second person and prospecting grade was answering a
 * question nobody asked. Agents, lenders and title reps are the opposite —
 * repeat business worth a real record — so their names still link there.
 *
 * Renders four <td>s into the row its parent owns. The inline form lives in a
 * <form id> with the inputs pointing at it via `form=`, since a <form> can't
 * straddle table cells.
 */
export function ParticipantEditor({
  contact,
  action,
  back,
  transactionId,
  simple,
  emails,
}: {
  contact: ParticipantContact;
  action: (formData: FormData) => void;
  /** Path to revalidate after a save — the transaction page. */
  back: string;
  transactionId: string;
  /** True for a buyer or seller: the name opens the dialog, not the record. */
  simple: boolean;
  /** Messages on this file that mention them, newest first. */
  emails: ParticipantEmail[];
}) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const formId = useId();

  return (
    <>
      <td className={td}>
        <span className="inline-flex items-center gap-1.5">
          {simple ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="font-medium text-brand-700 hover:underline"
            >
              {contact.name}
            </button>
          ) : (
            <Link
              href={`/dashboard/contacts/${contact.id}`}
              className="font-medium text-brand-700 hover:underline"
            >
              {contact.name}
            </Link>
          )}
          {simple ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              title="Edit contact details"
              aria-label={`Edit ${contact.name}`}
              className="text-stone-300 transition-colors hover:text-brand-700"
            >
              <PencilSimple size={12} aria-hidden />
            </button>
          ) : (
            <Link
              href={`/dashboard/contacts/${contact.id}/edit`}
              title="Edit contact details"
              aria-label={`Edit ${contact.name}`}
              className="text-stone-300 transition-colors hover:text-brand-700"
            >
              <PencilSimple size={12} aria-hidden />
            </Link>
          )}
        </span>
        {editing && (
          <form id={formId} action={action}>
            <input type="hidden" name="contactId" value={contact.id} />
            <input type="hidden" name="back" value={back} />
          </form>
        )}
      </td>

      <td className={td}>
        {editing ? (
          <input
            name="company"
            form={formId}
            defaultValue={contact.company ?? ""}
            aria-label="Company"
            className={`${input} min-w-28`}
          />
        ) : contact.company ? (
          <span className="inline-flex items-center gap-1">
            <Buildings size={13} className="text-stone-400" aria-hidden />
            {contact.company}
          </span>
        ) : (
          <span className="text-stone-300">—</span>
        )}
      </td>

      <td className={td}>
        {editing ? (
          <PhoneInput
            name="phone"
            form={formId}
            defaultValue={contact.phone ?? ""}
            aria-label="Phone"
            className={`${input} min-w-32`}
          />
        ) : contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
            className="inline-flex items-center gap-1 hover:underline"
          >
            <Phone size={13} className="text-stone-400" aria-hidden />
            {contact.phone}
          </a>
        ) : (
          <span className="text-stone-300">—</span>
        )}
      </td>

      <td className={td}>
        <span className="flex items-center gap-2">
          {editing ? (
            <input
              type="email"
              name="email"
              form={formId}
              defaultValue={contact.email ?? ""}
              aria-label="Email"
              className={`${input} min-w-40`}
            />
          ) : contact.email ? (
            <Link
              href={`/dashboard/transactions/${transactionId}?tab=emails&emailTo=${encodeURIComponent(contact.email)}`}
              className="inline-flex items-center gap-1 text-brand-700 hover:underline"
            >
              <Envelope size={13} aria-hidden />
              {contact.email}
            </Link>
          ) : (
            <span className="text-stone-300">—</span>
          )}
          {editing ? (
            <>
              {/* Submitted by hand rather than as the button's default action.
                  Leaving the row is what unmounts the <form>, and a plain
                  type="submit" would race that unmount against the browser's
                  own submit; requestSubmit() fires the event synchronously, so
                  the FormData is captured before anything disappears. */}
              <button
                type="button"
                onClick={(e) => {
                  const form = e.currentTarget.ownerDocument.getElementById(formId);
                  if (form instanceof HTMLFormElement) form.requestSubmit();
                  setEditing(false);
                }}
                className={`${btnGhost} shrink-0 px-2 py-1 text-xs`}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="shrink-0 text-xs text-stone-400 hover:text-stone-600"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Edit ${contact.name}'s company, phone and email`}
              className="ml-auto shrink-0 text-xs text-stone-300 transition-colors hover:text-brand-700"
            >
              edit
            </button>
          )}
        </span>
        {/* Inside the last cell rather than a <td> of its own: the overlay is
            position:fixed so it lands in the same place either way, and an
            extra cell would put a phantom column in every row. */}
        {open && (
          <ParticipantDialog
            contact={contact}
            action={action}
            back={back}
            emails={emails}
            onClose={() => setOpen(false)}
          />
        )}
      </td>
    </>
  );
}

function ParticipantDialog({
  contact,
  action,
  back,
  emails,
  onClose,
}: {
  contact: ParticipantContact;
  action: (formData: FormData) => void;
  back: string;
  emails: ParticipantEmail[];
  onClose: () => void;
}) {
  const [phones, setPhones] = useState<ContactPoint[]>(contact.extraPhones);
  const [mails, setMails] = useState<ContactPoint[]>(contact.extraEmails);

  // Escape closes, matching every other overlay in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    // No wrapper element: this renders inside the row's last <td>, and a <td>
    // (or a <div>) of its own would be invalid table markup. The overlay is
    // position:fixed, so its place in the tree doesn't affect where it lands.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white text-left shadow-xl">
        <header className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-800">Edit {contact.name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto text-stone-400 transition-colors hover:text-stone-700"
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        </header>

        <form action={action} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="contactId" value={contact.id} />
          <input type="hidden" name="back" value={back} />

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <label className={labelCls}>
              Name
              <input name="name" defaultValue={contact.name} required className={input} />
            </label>

            <label className={labelCls}>
              Company
              <input name="company" defaultValue={contact.company ?? ""} className={input} />
            </label>

            <div className="flex flex-col gap-2">
              <label className={labelCls}>
                Email
                <input
                  type="email"
                  name="email"
                  defaultValue={contact.email ?? ""}
                  className={input}
                />
              </label>
              <PointRows
                rows={mails}
                setRows={setMails}
                name="extraEmail"
                kind="email"
                addLabel="Add another email"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelCls}>
                Phone
                <PhoneInput name="phone" defaultValue={contact.phone ?? ""} className={input} />
              </label>
              <PointRows
                rows={phones}
                setRows={setPhones}
                name="extraPhone"
                kind="phone"
                addLabel="Add another phone"
              />
            </div>

            <label className={labelCls}>
              Notes
              <textarea
                name="notes"
                rows={3}
                defaultValue={contact.notes ?? ""}
                placeholder="Prefers texts after 6; wife handles the paperwork"
                className={`${input} resize-y`}
              />
            </label>

            {emails.length > 0 && (
              <div className="border-t border-stone-100 pt-3">
                <p className="text-xs font-medium text-stone-500">On these messages</p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {emails.map((e) => (
                    <li key={e.id} className="truncate text-xs text-stone-500">
                      <span className="text-stone-400">
                        {e.direction === "INBOUND" ? "↓" : "↑"} {e.createdAt}
                      </span>{" "}
                      {e.subject}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-stone-200 px-4 py-3">
            <button type="button" onClick={onClose} className={btnGhost}>
              Cancel
            </button>
            <SaveButton onDone={onClose}>Save</SaveButton>
          </footer>
        </form>
      </div>
    </div>
  );
}
