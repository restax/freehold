/**
 * Shared Tailwind class strings for the zero-JS form UI. Tightened to a
 * dense-enterprise scale (4px/8px grid, py-1.5 inputs) — Freehold is a
 * command center with a lot of data per screen, not a marketing page, so
 * default spacing favors fitting more without feeling cramped over airiness.
 */
export const input =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm shadow-xs transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15";
export const btn =
  "rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white shadow-xs transition hover:bg-brand-600 active:scale-[0.98]";
export const btnGhost =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1 text-sm text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]";
export const btnDanger = "text-sm text-red-700 transition-colors hover:text-red-900";
export const card =
  "rounded-lg border border-stone-200/70 bg-white p-4 shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)]";
/**
 * Wrap a data table in this. A wide table on a narrow window has to scroll
 * inside its own card — without it the table's intrinsic width pushes the
 * whole page into a horizontal scroll, which is what makes a small window
 * feel broken rather than merely tight.
 */
export const tableWrap = "-mx-1 overflow-x-auto px-1";
export const th =
  "border-b border-stone-200 px-2.5 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-stone-500";
export const td = "border-b border-stone-100 px-2.5 py-1.5 text-sm tabular-nums";
export const trHover = "transition-colors hover:bg-stone-50";
export const label = "flex flex-col gap-1 text-sm font-medium text-stone-700";
export const summaryLink =
  "cursor-pointer select-none font-medium text-brand-700 transition-colors marker:text-brand-600 hover:text-brand-600";
