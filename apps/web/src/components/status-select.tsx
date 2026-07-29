import { STATUS_LABEL } from "@/lib/format";
import { statusGroups } from "@/lib/transaction-status";
import { input, label as labelCls } from "@/lib/ui";

/**
 * The transaction status picker, grouped Open / Closed.
 *
 * Eight statuses in one flat run reads as a wall; the grouping says which
 * ones mean live work and which mean the file is finished, which is the
 * distinction a coordinator is actually making when they open this. Order
 * inside each group is lifecycle order, so the list matches the way a deal
 * moves rather than the alphabet.
 *
 * It renders its own <label> bound by id rather than expecting the caller to
 * wrap it: a wrapping label can't be seen to contain a control once the
 * control lives inside a component, which is both an a11y lint failure and a
 * genuine ambiguity for a screen reader.
 *
 * A plain <select> with no client JS — it's part of a server-action form.
 */
export function StatusSelect({
  defaultValue,
  name = "status",
  label = "Status",
  id,
}: {
  defaultValue: string;
  name?: string;
  label?: string;
  /** Needed because a server component can't call useId(). */
  id?: string;
}) {
  const selectId = id ?? `status-${name}`;
  return (
    <div className={labelCls}>
      <label htmlFor={selectId}>{label}</label>
      <select id={selectId} name={name} defaultValue={defaultValue} className={input}>
        {statusGroups().map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.statuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
