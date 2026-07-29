"use client";

import { MapPin } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import { type AddressSuggestion, shouldSearch } from "@/lib/address-search";
import { input as inputClass, label as labelClass } from "@/lib/ui";

/**
 * The address input, everywhere an address is entered.
 *
 * It stays a plain text field with a `name`: the surrounding server-action
 * form submits whatever is typed, so a rural address Mapbox has never heard
 * of, a brand-new subdivision, or a lookup that times out all still save. The
 * suggestions are an accelerator, not a gate — picking one is never required.
 *
 * When `fills` is given, choosing a suggestion also writes City / State / ZIP
 * into their own inputs in the same form, so the four fields agree instead of
 * a coordinator typing the street and leaving the rest blank. Those fields
 * stay editable afterwards — Mapbox is right about the ZIP more often than a
 * person is, but not always.
 */
export function AddressAutocomplete({
  name,
  label,
  defaultValue = "",
  required = false,
  placeholder = "Start typing an address…",
  fills,
}: {
  name: string;
  /** Omit to render the bare input (inside a caller's own <label>). */
  label?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  /**
   * Names of the sibling inputs to populate from the chosen suggestion. With
   * no `fills`, the field takes the whole one-line address instead — the shape
   * a single "Address" box (a client, a brokerage office) wants.
   */
  fills?: { city?: string; state?: string; zip?: string };
}) {
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Set when a suggestion is chosen, so the resulting value change doesn't
  // immediately fire another search and re-open the menu we just closed.
  //
  // Starts true for a prefilled field: on an edit form the value arrives
  // already populated, and searching it on mount would drop a suggestion
  // menu over the page before the coordinator has touched anything.
  const skipNextSearch = useRef(defaultValue.trim().length > 0);
  const listId = useId();
  const inputId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  // Debounced lookup. Each keystroke aborts the in-flight request, so a slow
  // response can't land after a newer one and repopulate a stale list.
  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (!shouldSearch(value)) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address-search?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: AddressSuggestion[] };
        setSuggestions(data.suggestions ?? []);
        setActive(0);
        if ((data.suggestions ?? []).length > 0) setOpen(true);
      } catch {
        // Aborted, offline, or a bad response: leave the list as-is. The field
        // is still a working text box.
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(s: AddressSuggestion) {
    skipNextSearch.current = true;
    setValue(fills ? s.address : s.label);
    setOpen(false);
    setSuggestions([]);

    const form = inputRef.current?.form;
    if (form && fills) {
      const put = (fieldName: string | undefined, next: string) => {
        if (!fieldName || !next) return;
        const el = form.elements.namedItem(fieldName);
        if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) el.value = next;
      };
      put(fills.city, s.city);
      put(fills.state, s.state);
      put(fills.zip, s.zip);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive(
        (i) => (i + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length,
      );
      return;
    }
    if (e.key === "Enter" && open && suggestions[active]) {
      // Enter picks the highlighted address; it must not also submit the form.
      e.preventDefault();
      choose(suggestions[active]);
    }
  }

  const field = (
    <div className="relative">
      <MapPin
        size={15}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
        aria-hidden
      />
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="text"
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && suggestions[active] ? optionId(active) : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className={`${inputClass} pl-8`}
      />
      {open && suggestions.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((s, i) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input owns keyboard handling; options are reached with arrows via aria-activedescendant, the standard pattern
            <div
              key={s.id}
              id={optionId(i)}
              role="option"
              tabIndex={-1}
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                // mousedown, not click: the click-outside handler would close
                // the menu before a click ever landed.
                e.preventDefault();
                choose(s);
              }}
              className={`cursor-pointer px-3 py-1.5 text-sm text-stone-700 ${
                i === active ? "bg-stone-50" : ""
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!label) return <div ref={rootRef}>{field}</div>;
  return (
    <div ref={rootRef}>
      <label htmlFor={inputId} className={`${labelClass} gap-1`}>
        {label}
      </label>
      <div className="mt-1">{field}</div>
    </div>
  );
}
