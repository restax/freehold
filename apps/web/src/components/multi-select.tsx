"use client";

import { Check, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

/**
 * Multi-select with removable chips and a checkmark dropdown.
 *
 * Chips carry their own ×, so removing one filter is a single click rather
 * than ⌘-clicking inside a native <select multiple> — which is the thing
 * nobody can discover and everybody gets wrong.
 *
 * It stays a plain form control: the value lives in hidden inputs named
 * `name`, so the surrounding GET form serializes to ?name=a&name=b exactly
 * as a native multi-select would, and the server keeps reading query params
 * with no idea a client island produced them.
 */
export function MultiSelect({
  name,
  label,
  options,
  defaultValue = [],
  placeholder = "Select…",
}: {
  name: string;
  /** Rendered as a real <label> bound to the text box. */
  label: string;
  options: MultiSelectOption[];
  defaultValue?: string[];
  placeholder?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const inputId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const labelOf = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  // Click outside closes the menu — the expected way out of a dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle(value: string) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    // Backspace on an empty box peels off the last chip, like every
    // token input people already know.
    if (e.key === "Backspace" && query === "" && selected.length > 0) {
      setSelected((prev) => prev.slice(0, -1));
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => {
        if (matches.length === 0) return 0;
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        return (next + matches.length) % matches.length;
      });
      return;
    }
    if (e.key === "Enter") {
      // Don't submit the surrounding filter form mid-selection.
      e.preventDefault();
      const opt = matches[active];
      if (open && opt) {
        toggle(opt.value);
        setQuery("");
      } else {
        setOpen(true);
      }
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </label>
      {selected.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}

      {/* biome-ignore lint/a11y/noStaticElementInteractions: focuses the real input inside */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the input itself handles keys */}
      <div
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
        className="flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-lg border border-stone-300 bg-white px-2 py-1 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20"
      >
        {selected.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded bg-stone-100 py-0.5 pl-2 pr-1 text-xs text-stone-700"
          >
            {labelOf.get(v) ?? v}
            <button
              type="button"
              aria-label={`Remove ${labelOf.get(v) ?? v}`}
              onClick={(e) => {
                e.stopPropagation();
                toggle(v);
              }}
              className="rounded p-0.5 text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-700"
            >
              <X size={11} weight="bold" aria-hidden />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-activedescendant={open && matches[active] ? optionId(active) : undefined}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          placeholder={selected.length === 0 ? placeholder : ""}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-16 flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
        />
        <MagnifyingGlass size={13} className="shrink-0 text-stone-400" aria-hidden />
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable
          aria-label={label}
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
        >
          {matches.length === 0 && <p className="px-3 py-2 text-sm text-stone-400">No matches</p>}
          {matches.map((o, i) => {
            const on = selected.includes(o.value);
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input owns keyboard handling; options are reached with arrows via aria-activedescendant, the standard pattern
              <div
                key={o.value}
                id={optionId(i)}
                role="option"
                tabIndex={-1}
                aria-selected={on}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  toggle(o.value);
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm ${
                  i === active ? "bg-stone-50" : ""
                } ${on ? "font-medium text-stone-900" : "text-stone-600"}`}
              >
                {o.label}
                {on && <Check size={14} weight="bold" className="text-brand-600" aria-hidden />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
