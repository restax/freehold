"use client";

import { CalendarBlank } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

/**
 * The closing-date pill in the transaction header. Click it for a popover
 * mini-calendar of this transaction's key dates — contract, close, and each
 * deadline task. Anchored on today's month (which is usually the closing
 * month); a second month appears only when the close date lands later, since
 * "this month or next month" covers the overwhelming majority of files.
 */

export type MarkerKind = "close" | "contract" | "deadline" | "other";

export interface DateMarker {
  /** YYYY-MM-DD. */
  date: string;
  label: string;
  kind: MarkerKind;
}

const KIND_DOT: Record<MarkerKind, string> = {
  close: "bg-brand-600",
  contract: "bg-amber-500",
  deadline: "bg-sky-500",
  other: "bg-stone-400",
};

const WEEKDAYS = [
  { key: "sun", label: "S" },
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
];

function keyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** A full 6-row (42-cell) grid for one month, starting on Sunday. */
function monthCells(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(Date.UTC(year, month, 1 - first.getUTCDay()));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d;
  });
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function prettyDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function MonthGrid({
  year,
  month,
  byDay,
  todayKey,
}: {
  year: number;
  month: number;
  byDay: Map<string, DateMarker[]>;
  todayKey: string;
}) {
  const cells = monthCells(year, month);
  return (
    <div>
      <p className="mb-2 text-center text-sm font-medium text-stone-700">
        {monthLabel(year, month)}
      </p>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w.key} className="text-[10px] font-medium text-stone-400">
            {w.label}
          </span>
        ))}
        {cells.map((d) => {
          const key = keyOf(d);
          const inMonth = d.getUTCMonth() === month;
          const marks = byDay.get(key) ?? [];
          const close = marks.find((m) => m.kind === "close");
          const isToday = key === todayKey;
          return (
            <div key={key} className="flex flex-col items-center justify-start">
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-xs ${
                  !inMonth ? "text-stone-300" : "text-stone-700"
                } ${close ? "bg-brand-600 font-semibold text-white" : ""} ${
                  isToday && !close ? "ring-1 ring-stone-400" : ""
                }`}
              >
                {d.getUTCDate()}
              </span>
              <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                {marks
                  .filter((m) => m.kind !== "close")
                  .slice(0, 3)
                  .map((m) => (
                    <span
                      key={`${m.kind}-${m.label}`}
                      className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[m.kind]}`}
                    />
                  ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ClosingDateCalendar({
  closeDate,
  markers,
}: {
  closeDate: string | null;
  markers: DateMarker[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const byDay = new Map<string, DateMarker[]>();
  for (const m of markers) {
    const list = byDay.get(m.date) ?? [];
    list.push(m);
    byDay.set(m.date, list);
  }

  const now = new Date();
  const anchorYear = now.getUTCFullYear();
  const anchorMonth = now.getUTCMonth();
  const todayKey = keyOf(now);

  const close = closeDate ? new Date(`${closeDate}T00:00:00Z`) : null;
  const closeLater =
    close != null &&
    (close.getUTCFullYear() > anchorYear ||
      (close.getUTCFullYear() === anchorYear && close.getUTCMonth() > anchorMonth));

  const panes: Array<[number, number]> = [[anchorYear, anchorMonth]];
  if (closeLater) {
    const d = new Date(Date.UTC(anchorYear, anchorMonth + 1, 1));
    panes.push([d.getUTCFullYear(), d.getUTCMonth()]);
  }

  const sortedMarkers = [...markers].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-xs transition hover:border-stone-300 hover:bg-stone-50"
      >
        <CalendarBlank size={16} className="text-brand-600" aria-hidden />
        {close ? (
          <>
            <span className="text-stone-500">Closes</span>
            <span className="font-medium">{prettyDate(closeDate as string)}</span>
          </>
        ) : (
          <span className="text-stone-500">Key dates</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-max rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
          <div className="flex gap-6">
            {panes.map(([y, m]) => (
              <MonthGrid key={`${y}-${m}`} year={y} month={m} byDay={byDay} todayKey={todayKey} />
            ))}
          </div>
          {sortedMarkers.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 border-t border-stone-100 pt-3">
              {sortedMarkers.map((m) => (
                <li
                  key={`${m.date}-${m.kind}-${m.label}`}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_DOT[m.kind]}`} />
                  <span className="w-16 shrink-0 tabular-nums text-stone-500">
                    {prettyDate(m.date)}
                  </span>
                  <span className="text-stone-700">{m.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
