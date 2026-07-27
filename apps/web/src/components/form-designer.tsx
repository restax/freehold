"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
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
import {
  ArrowsLeftRight,
  ArrowsOutLineVertical,
  Asterisk,
  DotsSixVertical,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { saveFormLayout } from "@/lib/actions/forms";
import {
  BLOCK_TYPES,
  FIELD_TYPE_LABEL,
  FIELD_TYPES,
  type FieldType,
  type FormBlock,
  type FormCell,
  type FormField,
  type FormKind,
  type FormLayout,
  type FormRow,
  isField,
  MAPPED_FIELDS,
  MAX_CELLS_PER_ROW,
  mappedField,
  normalizeLayout,
} from "@/lib/form-schema";
import { btn, btnGhost, input, label as labelCls } from "@/lib/ui";

/**
 * The drag-and-drop form designer.
 *
 * Arranging is drag-and-drop (rows reorder, palette items drag onto the
 * canvas); pairing two fields into one row is an explicit control rather
 * than a drop target. That split is deliberate: cross-container dragging
 * into a slot that may already be full is where builders like this get
 * flaky, and a "two columns" button is both more predictable and reachable
 * by keyboard. Row dragging keeps dnd-kit's keyboard sensor, so the whole
 * canvas is operable without a mouse.
 *
 * The layout invariants (max two cells a row, unique answer keys) are
 * re-applied server-side on save — this component is a convenience, never
 * the enforcement.
 */

function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

function fieldFromType(type: FieldType): FormField {
  return {
    id: newId("c"),
    kind: "field",
    type,
    key: newId("q"),
    label: FIELD_TYPE_LABEL[type],
    ...(type === "select" && { options: ["Option one", "Option two"] }),
  };
}

function fieldFromMapped(kind: FormKind, key: string): FormField {
  const m = mappedField(kind, key);
  if (!m) return fieldFromType("text");
  return {
    id: newId("c"),
    kind: "field",
    type: m.type,
    key: m.key,
    label: m.label,
    ...(m.options && { options: m.options }),
  };
}

function blockFromType(type: FormBlock["type"]): FormBlock {
  return {
    id: newId("b"),
    kind: "block",
    type,
    ...(type !== "divider" && { text: type === "heading" ? "Section heading" : "Some guidance." }),
  };
}

const BLOCK_LABEL: Record<FormBlock["type"], string> = {
  divider: "Divider",
  heading: "Heading",
  paragraph: "Paragraph",
};

// --- palette -------------------------------------------------------------

function PaletteButton({
  id,
  label,
  hint,
  onAdd,
}: {
  id: string;
  label: string;
  hint?: string;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id,
    data: { palette: true },
  });
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs transition-colors hover:border-stone-300 hover:bg-stone-50 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${label} onto the form`}
        className="cursor-grab text-stone-300 hover:text-stone-500 active:cursor-grabbing"
      >
        <DotsSixVertical size={13} weight="bold" />
      </button>
      <button type="button" onClick={onAdd} className="flex flex-1 flex-col items-start text-left">
        <span className="font-medium text-stone-700">{label}</span>
        {hint && <span className="text-[10px] text-stone-400">{hint}</span>}
      </button>
    </div>
  );
}

// --- one row on the canvas ----------------------------------------------

/** A patch is for one cell kind or the other — never both (`type` differs). */
type CellPatch = Partial<Omit<FormField, "kind">> | Partial<Omit<FormBlock, "kind">>;

function CellEditor({
  cell,
  kind,
  onChange,
}: {
  cell: FormCell;
  kind: FormKind;
  onChange: (patch: CellPatch) => void;
}) {
  if (!isField(cell)) {
    if (cell.type === "divider") {
      return <p className="text-xs text-stone-400">A horizontal rule. Nothing to configure.</p>;
    }
    return (
      <label className={labelCls}>
        Text
        <input
          value={cell.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
          className={input}
        />
      </label>
    );
  }
  const mapped = mappedField(kind, cell.key);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={labelCls}>
        Label
        <input
          value={cell.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className={input}
        />
      </label>
      <label className={labelCls}>
        Type
        <select
          value={cell.type}
          onChange={(e) => onChange({ type: e.target.value as FieldType })}
          className={input}
          disabled={Boolean(mapped)}
          title={mapped ? "This field's type is fixed by what it fills in" : undefined}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {FIELD_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className={labelCls}>
        Placeholder
        <input
          value={cell.placeholder ?? ""}
          onChange={(e) => onChange({ placeholder: e.target.value })}
          className={input}
        />
      </label>
      <label className={labelCls}>
        Help text
        <input
          value={cell.help ?? ""}
          onChange={(e) => onChange({ help: e.target.value })}
          className={input}
        />
      </label>
      {cell.type === "select" && (
        <label className={`${labelCls} sm:col-span-2`}>
          Choices (one per line)
          <textarea
            value={(cell.options ?? []).join("\n")}
            onChange={(e) =>
              onChange({
                options: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            rows={3}
            className={input}
          />
        </label>
      )}
      <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
        <input
          type="checkbox"
          checked={cell.required ?? false}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="accent-brand-600"
        />
        Required
      </label>
      <p className="text-xs text-stone-400 sm:col-span-2">
        {mapped ? (
          <>
            Fills in <span className="font-medium text-stone-600">{mapped.binds}</span> when this
            submission is turned into a real record.
          </>
        ) : (
          <>Custom question — the answer is kept with the submission.</>
        )}
      </p>
    </div>
  );
}

function CellChip({
  cell,
  kind,
  active,
  onSelect,
  onRemove,
}: {
  cell: FormCell;
  kind: FormKind;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const mapped = isField(cell) ? mappedField(kind, cell.key) : null;
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2 py-1.5 ${
        active ? "border-brand-600 bg-brand-50/50" : "border-stone-200 bg-white"
      }`}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 flex-col text-left">
        <span className="flex items-center gap-1 truncate text-xs font-medium text-stone-800">
          {isField(cell) ? cell.label : BLOCK_LABEL[cell.type]}
          {isField(cell) && cell.required && (
            <Asterisk
              size={9}
              weight="bold"
              className="shrink-0 text-red-500"
              aria-label="required"
            />
          )}
        </span>
        <span className="truncate text-[10px] text-stone-400">
          {isField(cell)
            ? `${FIELD_TYPE_LABEL[cell.type]}${mapped ? ` · ${mapped.binds}` : " · custom"}`
            : "layout"}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="shrink-0 text-stone-300 transition-colors hover:text-red-600"
      >
        <Trash size={13} />
      </button>
    </div>
  );
}

function SortableRow({
  row,
  kind,
  selectedCellId,
  onSelectCell,
  onRemoveCell,
  onSwap,
  onSplit,
}: {
  row: FormRow;
  kind: FormKind;
  selectedCellId: string | null;
  onSelectCell: (id: string) => void;
  onRemoveCell: (cellId: string) => void;
  onSwap: () => void;
  onSplit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // select-none: without it, dragging a row paints a text selection
      // across the canvas instead of feeling like you're moving an object.
      className={`flex select-none items-center gap-2 rounded-lg border bg-stone-50/60 p-1.5 ${
        isDragging ? "z-10 border-brand-400 shadow-md" : "border-transparent hover:border-stone-200"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Reorder this row"
        className="shrink-0 cursor-grab text-stone-300 hover:text-stone-500 active:cursor-grabbing"
      >
        <DotsSixVertical size={15} weight="bold" />
      </button>
      <div className="flex min-w-0 flex-1 gap-2">
        {row.cells.map((cell) => (
          <CellChip
            key={cell.id}
            cell={cell}
            kind={kind}
            active={cell.id === selectedCellId}
            onSelect={() => onSelectCell(cell.id)}
            onRemove={() => onRemoveCell(cell.id)}
          />
        ))}
      </div>
      {row.cells.length === MAX_CELLS_PER_ROW ? (
        <span className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onSwap}
            title="Swap the two columns"
            aria-label="Swap the two columns"
            className="text-stone-300 transition-colors hover:text-stone-600"
          >
            <ArrowsLeftRight size={13} />
          </button>
          <button
            type="button"
            onClick={onSplit}
            title="Split into two rows"
            aria-label="Split into two rows"
            className="text-stone-300 transition-colors hover:text-stone-600"
          >
            <ArrowsOutLineVertical size={13} />
          </button>
        </span>
      ) : (
        <span className="w-[13px] shrink-0" />
      )}
    </div>
  );
}

// --- the designer --------------------------------------------------------

export function FormDesigner({
  formId,
  kind,
  initialLayout,
}: {
  formId: string;
  kind: FormKind;
  initialLayout: FormLayout;
}) {
  const [layout, setLayout] = useState<FormLayout>(initialLayout);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const mutate = useCallback((next: (l: FormLayout) => FormLayout) => {
    setLayout((l) => normalizeLayout(next(l)));
    setDirty(true);
    setSavedAt(null);
  }, []);

  const appendCell = useCallback(
    (cell: FormCell) => {
      mutate((l) => ({ rows: [...l.rows, { id: newId("r"), cells: [cell] }] }));
      setSelectedCellId(cell.id);
    },
    [mutate],
  );

  const pairIntoPreviousRow = useCallback(
    (rowId: string) => {
      mutate((l) => {
        const i = l.rows.findIndex((r) => r.id === rowId);
        if (i <= 0) return l;
        const prev = l.rows[i - 1];
        const here = l.rows[i];
        if (prev.cells.length + here.cells.length > MAX_CELLS_PER_ROW) return l;
        const rows = [...l.rows];
        rows[i - 1] = { ...prev, cells: [...prev.cells, ...here.cells] };
        rows.splice(i, 1);
        return { rows };
      });
    },
    [mutate],
  );

  const selected = useMemo(() => {
    for (const r of layout.rows) {
      const c = r.cells.find((x) => x.id === selectedCellId);
      if (c) return { row: r, cell: c };
    }
    return null;
  }, [layout, selectedCellId]);

  function onDragStart(e: DragStartEvent) {
    setDragging(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;

    // Palette item dropped on the canvas → append it.
    if (active.data.current?.palette) {
      const id = String(active.id);
      if (id.startsWith("mapped:")) appendCell(fieldFromMapped(kind, id.slice(7)));
      else if (id.startsWith("type:")) appendCell(fieldFromType(id.slice(5) as FieldType));
      else if (id.startsWith("block:")) appendCell(blockFromType(id.slice(6) as FormBlock["type"]));
      return;
    }

    // Row reorder.
    if (active.id === over.id) return;
    mutate((l) => {
      const from = l.rows.findIndex((r) => r.id === active.id);
      const to = l.rows.findIndex((r) => r.id === over.id);
      if (from < 0 || to < 0) return l;
      const rows = [...l.rows];
      const [moved] = rows.splice(from, 1);
      rows.splice(to, 0, moved);
      return { rows };
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveFormLayout(formId, JSON.stringify(layout));
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
    });
  }

  const { setNodeRef: setCanvasRef, isOver } = useDroppable({ id: "canvas" });
  const paletteIds = useMemo(
    () => [
      ...MAPPED_FIELDS[kind].map((f) => `mapped:${f.key}`),
      ...FIELD_TYPES.map((t) => `type:${t}`),
      ...BLOCK_TYPES.map((b) => `block:${b}`),
    ],
    [kind],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        {/* Palette */}
        <SortableContext items={paletteIds}>
          <aside className="flex flex-col gap-3">
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Fills in a record
              </p>
              <div className="flex flex-col gap-1">
                {MAPPED_FIELDS[kind].map((f) => (
                  <PaletteButton
                    key={f.key}
                    id={`mapped:${f.key}`}
                    label={f.label}
                    hint={f.binds}
                    onAdd={() => appendCell(fieldFromMapped(kind, f.key))}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Custom question
              </p>
              <div className="flex flex-col gap-1">
                {FIELD_TYPES.map((t) => (
                  <PaletteButton
                    key={t}
                    id={`type:${t}`}
                    label={FIELD_TYPE_LABEL[t]}
                    onAdd={() => appendCell(fieldFromType(t))}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Layout
              </p>
              <div className="flex flex-col gap-1">
                {BLOCK_TYPES.map((b) => (
                  <PaletteButton
                    key={b}
                    id={`block:${b}`}
                    label={BLOCK_LABEL[b]}
                    onAdd={() => appendCell(blockFromType(b))}
                  />
                ))}
              </div>
            </div>
          </aside>
        </SortableContext>

        {/* Canvas + editor. min-w-0 lets this 1fr column shrink below its
            content — without it the rows push the whole page into a
            horizontal scroll on a narrow window. */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={!dirty || pending} className={btn}>
              {pending ? "Saving…" : "Save form"}
            </button>
            {dirty && !pending && <span className="text-xs text-amber-700">Unsaved changes</span>}
            {savedAt && !dirty && (
              <span className="text-xs text-brand-700">Saved at {savedAt}</span>
            )}
            {error && <span className="text-xs font-medium text-red-700">{error}</span>}
            <span className="ml-auto text-xs text-stone-400">
              Drag the handle to reorder · click a field to edit it
            </span>
          </div>

          <div
            ref={setCanvasRef}
            className={`min-h-32 rounded-lg border-2 border-dashed p-2 transition-colors ${
              isOver ? "border-brand-500 bg-brand-50/40" : "border-stone-200"
            }`}
          >
            {layout.rows.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-stone-400">
                Drag a field here, or click one in the list on the left.
              </p>
            ) : (
              <SortableContext
                items={layout.rows.map((r) => r.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-1">
                  {layout.rows.map((row, i) => (
                    <div key={row.id} className="flex flex-col">
                      {i > 0 && row.cells.length === 1 && layout.rows[i - 1].cells.length === 1 && (
                        <button
                          type="button"
                          onClick={() => pairIntoPreviousRow(row.id)}
                          className="mx-auto -my-0.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-stone-300 transition-colors hover:bg-stone-100 hover:text-stone-600"
                        >
                          <Plus size={9} weight="bold" />
                          two columns
                        </button>
                      )}
                      <SortableRow
                        row={row}
                        kind={kind}
                        selectedCellId={selectedCellId}
                        onSelectCell={setSelectedCellId}
                        onRemoveCell={(cellId) =>
                          mutate((l) => ({
                            rows: l.rows
                              .map((r) => ({ ...r, cells: r.cells.filter((c) => c.id !== cellId) }))
                              .filter((r) => r.cells.length > 0),
                          }))
                        }
                        onSwap={() =>
                          mutate((l) => ({
                            rows: l.rows.map((r) =>
                              r.id === row.id ? { ...r, cells: [...r.cells].reverse() } : r,
                            ),
                          }))
                        }
                        onSplit={() =>
                          mutate((l) => {
                            const idx = l.rows.findIndex((r) => r.id === row.id);
                            if (idx < 0) return l;
                            const [a, b] = l.rows[idx].cells;
                            const rows = [...l.rows];
                            rows.splice(
                              idx,
                              1,
                              { ...l.rows[idx], cells: [a] },
                              {
                                id: newId("r"),
                                cells: [b],
                              },
                            );
                            return { rows };
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </SortableContext>
            )}
          </div>

          {selected && (
            <div className="rounded-lg border border-stone-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                  Editing this field
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedCellId(null)}
                  className={`${btnGhost} px-2 py-0.5 text-xs`}
                >
                  Done
                </button>
              </div>
              <CellEditor
                cell={selected.cell}
                kind={kind}
                onChange={(patch) =>
                  mutate((l) => ({
                    rows: l.rows.map((r) => ({
                      ...r,
                      cells: r.cells.map((c) =>
                        c.id === selected.cell.id ? ({ ...c, ...patch } as FormCell) : c,
                      ),
                    })),
                  }))
                }
              />
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {dragging ? (
          <div className="rounded-md border border-brand-400 bg-white px-2 py-1.5 text-xs font-medium text-stone-700 shadow-lg">
            {dragging.startsWith("mapped:")
              ? (mappedField(kind, dragging.slice(7))?.label ?? "Field")
              : dragging.startsWith("type:")
                ? FIELD_TYPE_LABEL[dragging.slice(5) as FieldType]
                : dragging.startsWith("block:")
                  ? BLOCK_LABEL[dragging.slice(6) as FormBlock["type"]]
                  : "Row"}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
