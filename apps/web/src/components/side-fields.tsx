import type { SideLabels } from "@/lib/side-labels";
import { fieldGroupLabel, input, label } from "@/lib/ui";

/**
 * The money and dates that belong to each side of a deal.
 *
 * The two panels sit side by side in one fixed row — sell on the left, buy on
 * the right — and each keeps that spot whatever the side is. Switching between
 * Buy, Sell and Dual only changes which is *visible*; nothing reflows, so a
 * field a coordinator is reaching for never slides out from under the cursor.
 * The row is as tall as the taller panel at all times, by design: reserved
 * blank space is cheaper than movement.
 *
 * Visibility is driven by the side <select> through CSS in globals.css
 * (`.side-panel`), so this stays a plain server-rendered form with no client
 * JS and nothing to hydrate.
 *
 * Both panels are always in the DOM and always submit. That's deliberate:
 * the update action reads every field unconditionally, so an input that
 * disappeared from the payload would null the stored value — switching a
 * dual file to buy-side would silently erase the list price it already had.
 * Hiding is a display decision; it never destroys data.
 */
export function SideFields({
  labels,
  values,
  className = "",
}: {
  labels: SideLabels;
  /** Extra classes on the row — the edit form's grid needs a column span. */
  className?: string;
  /** Existing values, on the edit form. Omitted when creating. */
  values?: {
    listPrice?: number | null;
    listDate?: string;
    onMarketDate?: string;
    expireDate?: string;
    purchasePrice?: number | null;
    contractDate?: string;
  };
}) {
  const v = values ?? {};
  return (
    <div
      className={`grid gap-x-6 gap-y-4 border-t border-stone-100 pt-3 sm:grid-cols-2 ${className}`}
    >
      <div className="side-panel side-panel-sell">
        <p className={fieldGroupLabel}>{labels.sell} info</p>
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <label className={label}>
            List price ($)
            <input
              name="listPrice"
              inputMode="numeric"
              defaultValue={v.listPrice ?? ""}
              className={input}
            />
          </label>
          <label className={label}>
            List date
            <input name="listDate" type="date" defaultValue={v.listDate ?? ""} className={input} />
          </label>
          <label className={label}>
            On-market date
            <input
              name="onMarketDate"
              type="date"
              defaultValue={v.onMarketDate ?? ""}
              className={input}
            />
          </label>
          <label className={label}>
            Expire date
            <input
              name="expireDate"
              type="date"
              defaultValue={v.expireDate ?? ""}
              className={input}
            />
          </label>
        </div>
      </div>

      <div className="side-panel side-panel-buy">
        <p className={fieldGroupLabel}>{labels.buy} info</p>
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <label className={label}>
            Contract price ($)
            <input
              name="purchasePrice"
              inputMode="numeric"
              defaultValue={v.purchasePrice ?? ""}
              className={input}
            />
          </label>
          <label className={label}>
            Contract date
            <input
              name="contractDate"
              type="date"
              defaultValue={v.contractDate ?? ""}
              className={input}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
