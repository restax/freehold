"use client";

import { useMemo, useState } from "react";
import { PAY_CATEGORIES, type PayCategory, STATE_RULES } from "@/lib/tc-pay-rules";

/** One pastel per category, shared by the map, the legend and the table pills. */
const FILL: Record<PayCategory, string> = {
  red: "bg-red-200 text-red-900",
  amber: "bg-yellow-200 text-yellow-900",
  orange: "bg-orange-300 text-orange-950",
  green: "bg-green-200 text-green-900",
  gray: "bg-stone-200 text-stone-600",
};

export function PayRulesExplorer() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PayCategory | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STATE_RULES.filter(
      (s) =>
        (!category || s.category === category) &&
        (!q ||
          s.name.toLowerCase().includes(q) ||
          s.abbr.toLowerCase() === q ||
          s.rule.toLowerCase().includes(q)),
    );
  }, [query, category]);
  const shown = new Set(visible.map((s) => s.abbr));
  const filtered = Boolean(category || query.trim());

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <fieldset className="m-0 grid min-w-0 max-w-[620px] grid-cols-12 gap-1 border-0 p-0">
          <legend className="sr-only">State map. Select a state to see its rule.</legend>
          {STATE_RULES.map((s) => (
            <button
              key={s.abbr}
              type="button"
              title={`${s.name}: ${PAY_CATEGORIES[s.category].name}`}
              aria-label={`${s.name}, ${PAY_CATEGORIES[s.category].name}`}
              onClick={() => {
                setQuery(s.name);
                setCategory(null);
              }}
              style={{ gridColumn: s.tile[0] + 1, gridRow: s.tile[1] + 1 }}
              className={`flex aspect-square items-center justify-center rounded text-[clamp(0.55rem,1.6vw,0.78rem)] font-medium transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${FILL[s.category]} ${shown.has(s.abbr) ? "" : "opacity-25"}`}
            >
              {s.abbr}
            </button>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2.5">
          {(Object.keys(PAY_CATEGORIES) as PayCategory[]).map((k) => {
            const active = category === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setCategory(active ? null : k);
                  setQuery("");
                }}
                className={`grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 rounded-lg border bg-white px-3 py-2.5 text-left transition ${active ? "border-brand-600 ring-1 ring-brand-600" : "border-stone-200 hover:border-stone-300"}`}
              >
                <span className={`mt-1 h-3.5 w-3.5 rounded-sm border border-black/10 ${FILL[k]}`} />
                <span>
                  <span className="block text-sm font-semibold">{PAY_CATEGORIES[k].name}</span>
                  <span className="block text-[13px] leading-snug text-stone-500">
                    {PAY_CATEGORIES[k].desc}
                  </span>
                </span>
                <span className="text-sm tabular-nums text-stone-500">
                  {STATE_RULES.filter((s) => s.category === k).length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCategory(null);
            }}
            placeholder="Search a state or rule"
            aria-label="Search states"
            className="w-64 max-w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          />
          <div className="flex items-center gap-3 text-sm text-stone-500">
            <span aria-live="polite">
              {visible.length} of {STATE_RULES.length} states
            </span>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory(null);
                }}
                className="font-medium text-brand-700 underline"
              >
                Show all
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-stone-200/70 bg-white">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--section-header)] text-left text-[11px] font-semibold uppercase tracking-wide text-stone-600">
                <th className="px-4 py-2.5">State</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">What the rule says</th>
                <th className="px-4 py-2.5">Source</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.abbr} className="border-t border-stone-100 align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">
                    {s.name}
                    <span className="block text-xs font-normal text-stone-500">{s.abbr}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${FILL[s.category]}`}
                    >
                      {PAY_CATEGORIES[s.category].name}
                    </span>
                  </td>
                  <td className="px-4 py-3 leading-relaxed text-stone-700">{s.rule}</td>
                  <td className="px-4 py-3 text-[13px]">
                    {s.source.url ? (
                      <a
                        href={s.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-700 underline"
                      >
                        {s.source.label}
                      </a>
                    ) : (
                      <span className="text-stone-500">{s.source.label}</span>
                    )}
                    {s.source.date && (
                      <span className="block text-xs text-stone-500">{s.source.date}</span>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                    No state matches that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
