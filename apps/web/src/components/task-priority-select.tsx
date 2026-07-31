"use client";

/**
 * The Priority dropdown on a task row. Submits on choice — same pattern as
 * TaskStatusSelect. Replaces the old flag icon that cycled Normal → High →
 * Critical off in the trailing actions cluster: one control, in the column
 * that actually shows the value, instead of the value living in one place
 * and the only way to change it living somewhere else.
 */
export function TaskPrioritySelect({
  action,
  id,
  transactionId,
  priority,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  transactionId: string;
  priority: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <select
        name="priority"
        defaultValue={priority}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-stone-600 transition-colors hover:border-stone-200 focus:border-brand-600 focus:outline-none"
      >
        <option value="NORMAL">Normal</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>
    </form>
  );
}
