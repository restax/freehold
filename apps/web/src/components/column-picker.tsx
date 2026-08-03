"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical, Sliders, X } from "@phosphor-icons/react";
import { useMemo, useState, useTransition } from "react";
import type { ColumnDef } from "@/lib/table-columns";

/**
 * "Customize table": pick the columns, then drag them into the order you
 * want to read them in.
 *
 * The one client island on this page. Everything else stays server-rendered
 * — this needs to be interactive because reordering by drag is the whole
 * point, and a zero-JS version (submit, reload, repeat) would be miserable
 * for a ten-item reorder.
 *
 * Ordering lives in the right-hand list rather than in the checkbox list:
 * checking a column appends it, unchecking removes it, and the right list is
 * the single source of truth for both which columns show and in what order.
 */
export function ColumnPicker({
  all,
  groups,
  selected,
  action,
}: {
  all: ColumnDef[];
  groups: Array<{ group: string; columns: ColumnDef[] }>;
  selected: string[];
  /** Which table's preference this writes — transactions, contacts, … */
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<string[]>(selected);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const byKey = useMemo(() => new Map(all.map((c) => [c.key, c])), [all]);
  const chosen = useMemo(
    () => order.map((k) => byKey.get(k)).filter((c): c is ColumnDef => Boolean(c)),
    [order, byKey],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Keyboard dragging: the reorder has to be reachable without a mouse.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, columns: g.columns.filter((c) => c.label.toLowerCase().includes(q)) }))
      .filter((g) => g.columns.length > 0);
  }, [groups, search]);

  function toggle(col: ColumnDef, on: boolean) {
    if (col.locked) return;
    setOrder((prev) => (on ? [...prev, col.key] : prev.filter((k) => k !== col.key)));
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const from = prev.indexOf(String(active.id));
      const to = prev.indexOf(String(over.id));
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function apply() {
    const fd = new FormData();
    for (const k of order) fd.append("columns", k);
    startTransition(async () => {
      await action(fd);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        title="Choose which columns show and their order"
        onClick={() => {
          setOrder(selected);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 transition-colors hover:bg-stone-50"
      >
        <Sliders size={15} aria-hidden />
        Customize
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-600/40 bg-brand-50 px-3 py-1.5 text-sm text-brand-800"
        onClick={() => setOpen(false)}
      >
        <Sliders size={15} aria-hidden />
        Customize
      </button>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close, Esc handled on the dialog */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: same */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/30 p-4 pt-16"
        onClick={() => setOpen(false)}
      >
        <dialog
          open
          aria-label="Customize table"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="relative m-0 flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-stone-200 bg-white p-0 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
            <h2 className="flex items-center gap-2 font-medium text-stone-900">
              <Sliders size={17} aria-hidden />
              Customize table
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              title="Close without saving"
              className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 sm:grid-cols-2">
            {/* Left: what's available, grouped the way a coordinator thinks. */}
            <div className="flex min-h-0 flex-col border-stone-100 sm:border-r">
              <div className="p-4 pb-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search columns"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                {visibleGroups.map((g) => (
                  <div key={g.group} className="mb-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                      {g.group}
                    </p>
                    {g.columns.map((c) => {
                      const on = order.includes(c.key);
                      return (
                        <label
                          key={c.key}
                          className={`flex items-center gap-2 border-b border-stone-50 py-1.5 text-sm last:border-0 ${
                            c.locked ? "text-stone-400" : "cursor-pointer text-stone-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={c.locked}
                            onChange={(e) => toggle(c, e.target.checked)}
                            className="accent-brand-600"
                          />
                          {c.label}
                          {c.locked && <span className="text-xs text-stone-400">(always on)</span>}
                        </label>
                      );
                    })}
                  </div>
                ))}
                {visibleGroups.length === 0 && (
                  <p className="py-4 text-sm text-stone-400">No columns match “{search}”.</p>
                )}
              </div>
            </div>

            {/* Right: the order they'll actually read left-to-right. */}
            <div className="flex min-h-0 flex-col">
              <div className="px-4 pb-1 pt-4">
                <p className="font-medium text-stone-800">Column order</p>
                <p className="text-xs text-stone-500">Drag to reorder</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext
                    items={chosen.map((c) => c.key)}
                    strategy={verticalListSortingStrategy}
                  >
                    {chosen.map((c) => (
                      <SortableRow key={c.key} col={c} />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-stone-100 px-5 py-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 transition-colors hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={pending}
              className="rounded-lg bg-brand-700 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Apply"}
            </button>
          </div>
        </dialog>
      </div>
    </>
  );
}

function SortableRow({ col }: { col: ColumnDef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col.key,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex select-none items-center justify-between gap-2 border-b border-stone-50 py-2 text-sm text-stone-700 last:border-0 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <span className="truncate">{col.label}</span>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${col.label}`}
        title="Drag to reorder"
        className="cursor-grab rounded p-1 text-stone-300 transition-colors hover:bg-stone-100 hover:text-stone-500"
      >
        <DotsSixVertical size={16} aria-hidden />
      </button>
    </div>
  );
}
