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
import { DotsSixVertical, Plus, Trash } from "@phosphor-icons/react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { saveSiteBlocks, uploadSiteImage } from "@/lib/actions/website";
import {
  blockHiddenReason,
  newSiteBlock,
  normalizeSiteBlocks,
  SINGLETON_BLOCKS,
  SITE_BLOCK_HINT,
  SITE_BLOCK_LABEL,
  SITE_BLOCK_TYPES,
  SITE_IMAGE_MAX_BYTES,
  SITE_IMAGE_TYPES,
  type SiteBlock,
  type SiteBlockType,
  siteImageId,
  siteImageUrl,
} from "@/lib/site-blocks";
import { SITE_PREVIEW_REFRESH } from "@/lib/site-preview-events";
import { btn, input, label as labelCls } from "@/lib/ui";

/**
 * The drag-and-drop website designer.
 *
 * Same split as the intake-form designer (components/form-designer.tsx):
 * reordering is drag-and-drop, everything else is an explicit control.
 * Palette items are added by click rather than by dragging across
 * containers — cross-container drops are where builders like this get flaky,
 * and a button is reachable by keyboard. Block dragging keeps dnd-kit's
 * keyboard sensor, so the canvas is operable without a mouse.
 *
 * Invariants (unique ids, one hero / forms / contact form) are re-applied
 * server-side on save; this component is a convenience, never the
 * enforcement.
 */

function newId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `b_${rand}`;
}

/** Fields each block type exposes, so the editor is data rather than a pile of ifs. */
type FieldSpec = { key: string; label: string; kind: "text" | "textarea" | "lines" | "image" };

const BLOCK_FIELDS: Record<SiteBlockType, FieldSpec[]> = {
  hero: [
    { key: "heading", label: "Headline", kind: "text" },
    { key: "body", label: "Intro paragraph", kind: "textarea" },
    { key: "ctaLabel", label: "Button label (blank hides it)", kind: "text" },
    { key: "imageSrc", label: "Photo (blank uses the stock photograph)", kind: "image" },
  ],
  about: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
  ],
  text: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
  ],
  services: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "items", label: "One service per line", kind: "lines" },
  ],
  forms: [{ key: "heading", label: "Heading", kind: "text" }],
  registration: [{ key: "heading", label: "Heading", kind: "text" }],
  image: [
    { key: "src", label: "Photo", kind: "image" },
    { key: "alt", label: "Describe the photo (for screen readers)", kind: "text" },
  ],
  testimonial: [
    { key: "quote", label: "Quote", kind: "textarea" },
    { key: "author", label: "Who said it", kind: "text" },
    { key: "role", label: "Their role or company", kind: "text" },
  ],
};

/**
 * Pick a photograph for a block.
 *
 * Upload is the main path — a TC has a photo on their laptop, not a CDN URL.
 * The address box stays for anyone who already hosts their images somewhere,
 * and is the only way to see or clear a value that came from there.
 *
 * The file goes up immediately rather than waiting for "Save layout": the
 * thumbnail is the confirmation that the right photo was chosen, and holding
 * bytes in browser memory until an unrelated button is pressed would mean
 * losing them to a refresh. Uploads nothing ends up using are swept when the
 * layout is saved (sweepSiteImages in actions/website.ts).
 */
function ImageField({
  label,
  value,
  slug,
  onChange,
}: {
  label: string;
  value: string | undefined;
  slug: string;
  onChange: (next: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = siteImageUrl(value, slug);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!(SITE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError("Images must be PNG, JPEG, or WebP.");
      return;
    }
    if (file.size > SITE_IMAGE_MAX_BYTES) {
      setError(`That photo is over ${Math.floor(SITE_IMAGE_MAX_BYTES / 1_000_000)} MB.`);
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await uploadSiteImage(body);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onChange(res.ref);
    } catch {
      // The action can fail outside its own error contract — a dropped
      // connection, a request body the host rejects. Without this the field
      // sits on "Uploading…" for good and the only way out is a refresh.
      setError("That upload didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      {preview && (
        <div className="flex items-center gap-3">
          {/* biome-ignore lint/performance/noImgElement: an arbitrary tenant-chosen URL, not a bundled asset next/image can size. */}
          <img
            src={preview}
            alt=""
            className="h-16 w-28 rounded-lg border border-stone-200 object-cover"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-sm text-red-700 hover:text-red-900"
          >
            Remove
          </button>
        </div>
      )}
      <input
        type="file"
        accept={SITE_IMAGE_TYPES.join(",")}
        disabled={busy}
        onChange={(e) => pick(e.target.files?.[0])}
        className="text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
      />
      <label className="flex flex-col gap-1 text-xs text-stone-400">
        …or paste the address of a photo you host elsewhere
        <input
          className={input}
          value={siteImageId(value) ? "" : (value ?? "")}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      {busy && <span className="text-xs text-stone-400">Uploading…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

function SortableBlock({
  block,
  expanded,
  onToggle,
  onChange,
  onRemove,
  slug,
  hasPublicForms,
  intakeFormHref,
}: {
  block: SiteBlock;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
  slug: string;
  hasPublicForms: boolean;
  intakeFormHref: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const rec = block as unknown as Record<string, unknown>;
  const hidden = blockHiddenReason(block, {
    hasPublicForms,
    hasIntakeForm: Boolean(intakeFormHref),
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border bg-white ${
        isDragging ? "border-brand-400 shadow-lg" : "border-stone-200"
      }`}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-stone-400 hover:text-stone-600 active:cursor-grabbing"
          aria-label={`Move ${SITE_BLOCK_LABEL[block.type]}`}
          {...attributes}
          {...listeners}
        >
          <DotsSixVertical size={16} weight="bold" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
          aria-expanded={expanded}
        >
          <span className={`text-sm font-medium ${hidden ? "text-stone-400" : "text-stone-800"}`}>
            {SITE_BLOCK_LABEL[block.type]}
          </span>
          <span className={`truncate text-xs ${hidden ? "text-amber-700" : "text-stone-400"}`}>
            {hidden ?? (String(rec.heading ?? rec.quote ?? "") || SITE_BLOCK_HINT[block.type])}
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-stone-300 hover:text-red-600"
          aria-label={`Remove ${SITE_BLOCK_LABEL[block.type]}`}
        >
          <Trash size={15} />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-stone-100 px-3 py-3">
          {BLOCK_FIELDS[block.type].map((f) => {
            const raw = rec[f.key];
            if (f.kind === "image") {
              return (
                <ImageField
                  key={f.key}
                  label={f.label}
                  slug={slug}
                  value={typeof raw === "string" ? raw : undefined}
                  onChange={(next) => onChange({ [f.key]: next })}
                />
              );
            }
            if (f.kind === "lines") {
              return (
                <label key={f.key} className={labelCls}>
                  {f.label}
                  <textarea
                    rows={4}
                    className={input}
                    defaultValue={Array.isArray(raw) ? (raw as string[]).join("\n") : ""}
                    onChange={(e) =>
                      onChange({
                        [f.key]: e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
              );
            }
            if (f.kind === "textarea") {
              return (
                <label key={f.key} className={labelCls}>
                  {f.label}
                  <textarea
                    rows={3}
                    className={input}
                    defaultValue={typeof raw === "string" ? raw : ""}
                    onChange={(e) => onChange({ [f.key]: e.target.value })}
                  />
                </label>
              );
            }
            return (
              <label key={f.key} className={labelCls}>
                {f.label}
                <input
                  className={input}
                  defaultValue={typeof raw === "string" ? raw : ""}
                  onChange={(e) => onChange({ [f.key]: e.target.value })}
                />
              </label>
            );
          })}
          {block.type === "forms" && (
            <p className="text-xs text-stone-400">
              Lists the intake forms you've published to the public website — nothing to pick here.
            </p>
          )}
          {block.type === "registration" && (
            <p className="text-xs text-stone-400">
              This shows your <strong className="font-medium text-stone-600">New client</strong>{" "}
              form, so the questions are the ones you ask — office name, brokerage, where invoices
              go.{" "}
              {intakeFormHref ? (
                <a href={intakeFormHref} className="font-medium text-brand-700 hover:underline">
                  Edit that form →
                </a>
              ) : (
                <a href="/dashboard/forms" className="font-medium text-brand-700 hover:underline">
                  Create one under Forms →
                </a>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function SiteDesigner({
  initialBlocks,
  slug,
  hasPublicForms,
  intakeFormHref,
}: {
  initialBlocks: SiteBlock[];
  /** Addresses uploaded photographs — /api/site-image/<slug>/<id>. */
  slug: string;
  /** Whether the Intake forms block has anything to list. */
  hasPublicForms: boolean;
  /** Where to edit the New client form the contact-form block renders. */
  intakeFormHref: string | null;
}) {
  const [blocks, setBlocks] = useState<SiteBlock[]>(initialBlocks);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const mutate = useCallback((next: (b: SiteBlock[]) => SiteBlock[]) => {
    setBlocks((b) => normalizeSiteBlocks(next(b)));
    setDirty(true);
    setSavedAt(null);
  }, []);

  const used = useMemo(() => new Set(blocks.map((b) => b.type)), [blocks]);

  function addBlock(type: SiteBlockType) {
    const block = newSiteBlock(type, newId());
    mutate((b) => [...b, block]);
    setExpandedId(block.id);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    mutate((b) => {
      const from = b.findIndex((x) => x.id === active.id);
      const to = b.findIndex((x) => x.id === over.id);
      if (from < 0 || to < 0) return b;
      const next = [...b];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveSiteBlocks(JSON.stringify(blocks));
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
      // The preview is a separate document, so revalidatePath doesn't touch
      // it — tell it to reload rather than leaving it a save behind. An event
      // rather than a shared parent because the two panes are siblings under
      // a server component, which can't hold the state between them.
      window.dispatchEvent(new Event(SITE_PREVIEW_REFRESH));
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-stone-400">
            Add a section
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SITE_BLOCK_TYPES.map((type) => {
              const taken = SINGLETON_BLOCKS.has(type) && used.has(type);
              return (
                <button
                  key={type}
                  type="button"
                  disabled={taken}
                  onClick={() => addBlock(type)}
                  title={
                    taken
                      ? `Your page already has a ${SITE_BLOCK_LABEL[type]}`
                      : SITE_BLOCK_HINT[type]
                  }
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
                    taken
                      ? "cursor-not-allowed border-stone-100 text-stone-300"
                      : "border-stone-200 text-stone-700 hover:border-brand-400 hover:text-brand-700"
                  }`}
                >
                  <Plus size={12} weight="bold" aria-hidden />
                  {SITE_BLOCK_LABEL[type]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                expanded={expandedId === block.id}
                onToggle={() => setExpandedId((id) => (id === block.id ? null : block.id))}
                onChange={(patch) =>
                  mutate((b) =>
                    b.map((x) => (x.id === block.id ? ({ ...x, ...patch } as SiteBlock) : x)),
                  )
                }
                onRemove={() => mutate((b) => b.filter((x) => x.id !== block.id))}
                slug={slug}
                hasPublicForms={hasPublicForms}
                intakeFormHref={intakeFormHref}
              />
            ))}
          </SortableContext>
          {blocks.length === 0 && (
            <p className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
              Your page has no sections yet — add one above.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            // btn has no disabled state of its own, and a Save button that
            // looks live with nothing to save invites a click that does
            // nothing.
            className={`${btn} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-700`}
          >
            {pending ? "Saving…" : "Save layout"}
          </button>
          {dirty && !pending && <span className="text-xs text-amber-700">Unsaved changes</span>}
          {savedAt && !dirty && <span className="text-xs text-stone-400">Saved at {savedAt}</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </DndContext>
  );
}
