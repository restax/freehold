"use client";

/**
 * "Start from a template" on the compose form — a grouped dropdown instead
 * of every template in the workspace laid out as a wall of pill buttons.
 * Submits on choice (a GET, so it's just navigation to the same URL with
 * `emailTemplate` set) via the same zero-extra-state pattern as a native
 * date input: no client state to own, the server re-renders with the
 * selected template's content prefilled.
 */
export function EmailTemplateSelect({
  transactionId,
  emailTask,
  groups,
  selected,
}: {
  transactionId: string;
  emailTask?: string;
  /** Folder name (or "No folder") to the templates in it, both name-sorted. */
  groups: Array<{ label: string; items: Array<{ id: string; name: string }> }>;
  selected?: string;
}) {
  return (
    <form method="GET" action={`/dashboard/transactions/${transactionId}`}>
      <input type="hidden" name="tab" value="emails" />
      {emailTask && <input type="hidden" name="emailTask" value={emailTask} />}
      <select
        name="emailTemplate"
        defaultValue={selected ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-full max-w-sm rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-600 focus:outline-none"
      >
        <option value="">Start from a template…</option>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </form>
  );
}
