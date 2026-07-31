"use client";

/**
 * The Status dropdown on a task row. Submits on choice — same "commit
 * immediately" feel as KeyDateRow's date input. Because the done-checkbox
 * simply renders `status === "DONE"`, picking Done here and clicking the
 * checkbox land on the exact same state; there's nothing extra to keep in
 * sync.
 */
export function TaskStatusSelect({
  action,
  id,
  transactionId,
  status,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  transactionId: string;
  status: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-stone-600 transition-colors hover:border-stone-200 focus:border-brand-600 focus:outline-none"
      >
        <option value="OPEN">Open</option>
        <option value="DONE">Done</option>
        <option value="HOLD">Hold</option>
        <option value="SKIPPED">Canceled</option>
      </select>
    </form>
  );
}
