"use client";

import { useEffect, useRef, useState } from "react";
import { EntityPicker, type PickerOption } from "@/components/entity-picker";
import { createContactByName } from "@/lib/actions/contacts";
import { commissionLabel } from "@/lib/commission";
import { input, label } from "@/lib/ui";

/**
 * Who worked the file and what it pays.
 *
 * The four people split two ways. Primary agent and co-agent are the agents on
 * our side of the deal and come from the workspace's contacts, so a name that
 * isn't there yet can be added without leaving the form. TC and assistant are
 * *our* people — workspace users on paid seats — so those pickers only ever
 * search: a coordinator can't be conjured out of a text box, they need an
 * invite and a seat.
 *
 * A client component because the commission label follows the client. For an
 * individual agent the client is the earner ("Client's commission"); for a
 * brokerage or team the money belongs to one of their agents ("Agent's
 * commission"). Getting that backwards is the difference between recording the
 * office's split and the agent's, so it tracks the live selection rather than
 * whatever the client happened to be when the page rendered.
 */
export function AgentsCommissions({
  contacts,
  users,
  clientTypes,
  clientSelectName = "clientId",
  includeAssignees = true,
  defaults,
}: {
  contacts: PickerOption[];
  users: PickerOption[];
  /** clientId → ClientType, for the label rule. */
  clientTypes: Record<string, string>;
  clientSelectName?: string;
  /**
   * Whether to offer the TC/assistant slots. Off on the transaction's own
   * page, where Participants already manages assignment — and does it better,
   * with per-person fees and no cap of two. Two slots posting there would
   * unassign everyone past the second on every save.
   */
  includeAssignees?: boolean;
  defaults?: {
    primaryAgentContactId?: string | null;
    coAgentContactId?: string | null;
    assigneeIds?: string[];
    commissionPct?: number | null;
    estimatedGrossCents?: number | null;
    actualGrossCents?: number | null;
    clientId?: string | null;
  };
}) {
  const d = defaults ?? {};
  const [clientId, setClientId] = useState(d.clientId ?? "");
  const rootRef = useRef<HTMLElement>(null);

  // The client select lives in a different section of the same form, so listen
  // to it where it is rather than moving it in here and disturbing that layout.
  //
  // Scoped to our own <form>, not the document: the new-transaction page also
  // carries a client picker on the contract uploader, and a document-wide
  // lookup found that one instead — so the label tracked a select this form
  // never submits.
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    const el = form?.querySelector<HTMLSelectElement>(`select[name="${clientSelectName}"]`);
    if (!el) return;
    setClientId(el.value);
    const onChange = () => setClientId(el.value);
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, [clientSelectName]);

  const money = (cents: number | null | undefined) =>
    cents == null ? "" : (cents / 100).toFixed(2);

  return (
    <section ref={rootRef}>
      <p className="mb-1.5 text-sm font-semibold text-stone-900">Agents &amp; Commissions</p>
      <div className="rounded-lg border border-stone-200/80 bg-white p-4">
        <div
          className={`grid gap-x-5 gap-y-4 sm:grid-cols-2 ${
            includeAssignees ? "lg:grid-cols-4" : "lg:grid-cols-2"
          }`}
        >
          <EntityPicker
            name="primaryAgentContactId"
            label="Primary Agent"
            options={contacts}
            defaultId={d.primaryAgentContactId ?? ""}
            onCreate={createContactByName}
            createHint="Add contact"
          />
          <EntityPicker
            name="coAgentContactId"
            label="Co-Agent"
            options={contacts}
            defaultId={d.coAgentContactId ?? ""}
            onCreate={createContactByName}
            createHint="Add contact"
          />
          {includeAssignees && (
            <>
              <EntityPicker
                name="assigneeIds"
                label="TC/Assistant 1"
                options={users}
                defaultId={d.assigneeIds?.[0] ?? ""}
              />
              <EntityPicker
                name="assigneeIds"
                label="TC/Assistant 2"
                options={users}
                defaultId={d.assigneeIds?.[1] ?? ""}
              />
            </>
          )}
        </div>

        <div className="mt-4 grid gap-x-5 gap-y-4 border-t border-stone-100 pt-4 sm:grid-cols-3">
          <label className={label}>
            {commissionLabel(clientTypes[clientId])}
            <input
              name="commissionPct"
              inputMode="decimal"
              defaultValue={d.commissionPct ?? ""}
              placeholder="e.g. 3 (not 6)"
              className={input}
            />
          </label>
          <label className={label}>
            Estimated Gross Payout
            <input
              name="estimatedGross"
              inputMode="decimal"
              defaultValue={money(d.estimatedGrossCents)}
              placeholder="0.00"
              className={input}
            />
            <span className="text-xs font-normal text-stone-400">
              Rarely stated in the contract — what the agent expects to be paid.
            </span>
          </label>
          <label className={label}>
            Actual Gross Payout
            <input
              name="actualGross"
              inputMode="decimal"
              defaultValue={money(d.actualGrossCents)}
              placeholder="0.00"
              className={input}
            />
            <span className="text-xs font-normal text-stone-400">
              Fill in once the broker has paid the agent.
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}
