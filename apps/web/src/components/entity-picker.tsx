"use client";

import { CaretDown, Plus, User, X } from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { input as inputCls, label as labelCls } from "@/lib/ui";

export interface PickerOption {
  id: string;
  name: string;
  /** Second line in the row — an email, a role, whatever disambiguates. */
  hint?: string | null;
}

/**
 * A single-select "type to search" picker over a known list.
 *
 * Used for the people on a transaction: the agents (workspace contacts) and
 * the coordinators (workspace users). A plain <select> was unusable once a
 * workspace had a few hundred contacts — you can't find someone in a list you
 * can't type into.
 *
 * The list is passed in whole rather than searched over the wire. It's a few
 * hundred names at most, filtering locally is instant, and it keeps the picker
 * working the moment the page renders. Contrast the address picker, which must
 * call out because the whole of the US isn't a list we could ship.
 *
 * The value lives in a hidden input, so the surrounding zero-JS server-action
 * form submits an id exactly as a <select> would and the server is none the
 * wiser.
 */
export function EntityPicker({
  name,
  label,
  options,
  defaultId = "",
  placeholder = "Type to search…",
  onCreate,
  createHint = "Add",
  onSelect,
}: {
  name: string;
  label: string;
  options: PickerOption[];
  defaultId?: string;
  placeholder?: string;
  /**
   * Given a typed name, create the record and return it. Omitted for people
   * who can't be conjured — a coordinator is a paid seat and needs an invite,
   * so those pickers only ever search.
   */
  onCreate?: (name: string) => Promise<{ id: string; name: string } | null>;
  createHint?: string;
  /**
   * Fires whenever a choice lands — picked from the list, or just created.
   * The picker's own value already reaches the server through its hidden
   * input; this is for a sibling field in the same form that wants to react
   * client-side, e.g. prefilling an email from the contact just chosen.
   */
  onSelect?: (option: PickerOption) => void;
}) {
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const [selected, setSelected] = useState<PickerOption | null>(byId.get(defaultId) ?? null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const inputId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options
      .filter((o) => `${o.name} ${o.hint ?? ""}`.toLowerCase().includes(q))
      .slice(0, 50);
  }, [options, query]);

  // Offer creation only for a genuinely new name — not while the typed text
  // still names somebody who already exists.
  const canCreate =
    Boolean(onCreate) &&
    query.trim().length > 1 &&
    !options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(o: PickerOption) {
    setSelected(o);
    setQuery("");
    setOpen(false);
    onSelect?.(o);
  }

  async function createNow() {
    if (!onCreate || creating) return;
    const wanted = query.trim();
    setCreating(true);
    try {
      const made = await onCreate(wanted);
      if (made) choose(made);
    } catch {
      // Leave the box as it was; the coordinator can retry or pick an
      // existing name. Losing the rest of the form to a failed create here
      // would be far worse than a click that didn't take.
    } finally {
      setCreating(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const n = matches.length + (canCreate ? 1 : 0);
      if (n === 0) return;
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault(); // never submit the surrounding form mid-pick
      if (!open) {
        setOpen(true);
        return;
      }
      const opt = matches[active];
      if (opt) choose(opt);
      else if (canCreate) void createNow();
    }
    if (e.key === "Backspace" && query === "" && selected) setSelected(null);
  }

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={inputId} className={`${labelCls} gap-1`}>
        {label}
      </label>
      <input type="hidden" name={name} value={selected?.id ?? ""} />

      <div className="relative mt-1">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? optionId(active) : undefined}
          value={open ? query : (selected?.name ?? "")}
          placeholder={selected ? selected.name : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className={`${inputCls} w-full pr-14 ${selected && !open ? "text-stone-900" : ""}`}
        />
        {selected && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => {
              setSelected(null);
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-7 top-1/2 -translate-y-1/2 rounded p-0.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            <X size={12} weight="bold" aria-hidden />
          </button>
        )}
        <CaretDown
          size={13}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400"
          aria-hidden
        />
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
        >
          {matches.length === 0 && !canCreate && (
            <p className="px-3 py-2 text-sm text-stone-400">No matches</p>
          )}
          {matches.map((o, i) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input owns keyboard handling; options are reached with arrows via aria-activedescendant, the standard pattern
            <div
              key={o.id}
              id={optionId(i)}
              role="option"
              tabIndex={-1}
              aria-selected={selected?.id === o.id}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                // mousedown, not click: click-outside would close the menu
                // before a click ever landed.
                e.preventDefault();
                choose(o);
              }}
              className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
                i === active ? "bg-stone-50" : ""
              }`}
            >
              <User size={15} className="shrink-0 text-stone-400" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-stone-700">{o.name}</span>
              {o.hint && <span className="shrink-0 text-xs text-stone-400">{o.hint}</span>}
            </div>
          ))}
          {canCreate && (
            // biome-ignore lint/a11y/useKeyWithClickEvents: reached with arrows through the combobox, same as the options above
            <div
              id={optionId(matches.length)}
              role="option"
              tabIndex={-1}
              aria-selected={false}
              onMouseEnter={() => setActive(matches.length)}
              onMouseDown={(e) => {
                e.preventDefault();
                void createNow();
              }}
              className={`flex cursor-pointer items-center gap-2 border-t border-stone-100 px-3 py-2 text-sm font-medium text-brand-700 ${
                active === matches.length ? "bg-stone-50" : ""
              }`}
            >
              <Plus size={14} weight="bold" aria-hidden />
              {creating ? "Adding…" : `${createHint} “${query.trim()}”`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
