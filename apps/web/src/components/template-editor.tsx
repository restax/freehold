"use client";

import {
  Eye,
  Image as ImageIcon,
  LinkSimple,
  ListBullets,
  TextB,
  TextHOne,
  TextHTwo,
  TextItalic,
} from "@phosphor-icons/react";
import { useId, useState } from "react";
import { LiveDictateButton } from "@/components/live-dictate-button";
import { trackMergeFocus } from "@/components/merge-field-browser";
import { EMAIL_MERGE_CODES, renderLiteMarkdown } from "@/lib/email-template";

/**
 * The email body editor: formatting toolbar + merge-field picker + voice
 * dictation + live preview of the rendered email. Under the hood it's
 * markdown-lite in a plain textarea — deliberately not a rich-text editor,
 * so what you see survives every browser and every mail client.
 */
export function TemplateEditor({
  name,
  defaultValue,
  rows = 10,
}: {
  name: string;
  defaultValue?: string;
  rows?: number;
}) {
  const id = useId().replace(/[:]/g, "");
  const areaId = `tpl-${id}`;
  const [value, setValue] = useState(defaultValue ?? "");
  const [preview, setPreview] = useState(false);

  function getArea(): HTMLTextAreaElement | null {
    return document.getElementById(areaId) as HTMLTextAreaElement | null;
  }

  /** Insert text at the cursor (or wrap the selection). */
  function insert(before: string, after = "") {
    const area = getArea();
    if (!area) return;
    const { selectionStart: start, selectionEnd: end } = area;
    const selected = area.value.slice(start, end);
    const next = area.value.slice(0, start) + before + selected + after + area.value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      area.focus();
      const pos = start + before.length + selected.length + after.length;
      area.setSelectionRange(selected ? start : pos, pos);
    });
  }

  /** Prefix the current line (headings, bullets). */
  function prefixLine(prefix: string) {
    const area = getArea();
    if (!area) return;
    const start = area.value.lastIndexOf("\n", area.selectionStart - 1) + 1;
    const next = area.value.slice(0, start) + prefix + area.value.slice(start);
    setValue(next);
    requestAnimationFrame(() => area.focus());
  }

  /** Insert a standalone block (an image) on its own blank-line-separated paragraph. */
  function insertBlock(text: string) {
    const area = getArea();
    if (!area) return;
    const { selectionStart: start, selectionEnd: end } = area;
    const next = `${area.value.slice(0, start)}\n\n${text}\n\n${area.value.slice(end)}`;
    setValue(next);
    requestAnimationFrame(() => area.focus());
  }

  function addLink() {
    const url = window.prompt("Link URL");
    if (!url) return;
    insert("[", `](${url})`);
  }

  function addImage() {
    const url = window.prompt("Image URL");
    if (!url) return;
    insertBlock(`![](${url})`);
  }

  const toolBtn =
    "flex h-7 w-7 items-center justify-center rounded border border-stone-200 text-stone-600 transition-colors hover:border-brand-600 hover:text-brand-700";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" title="Bold" className={toolBtn} onClick={() => insert("**", "**")}>
          <TextB size={14} weight="bold" />
        </button>
        <button type="button" title="Italic" className={toolBtn} onClick={() => insert("_", "_")}>
          <TextItalic size={14} />
        </button>
        <button
          type="button"
          title="Big heading"
          className={toolBtn}
          onClick={() => prefixLine("# ")}
        >
          <TextHOne size={14} />
        </button>
        <button
          type="button"
          title="Medium heading"
          className={toolBtn}
          onClick={() => prefixLine("## ")}
        >
          <TextHTwo size={14} />
        </button>
        <button
          type="button"
          title="Bullet list"
          className={toolBtn}
          onClick={() => prefixLine("- ")}
        >
          <ListBullets size={14} />
        </button>
        <button type="button" title="Insert link" className={toolBtn} onClick={addLink}>
          <LinkSimple size={14} />
        </button>
        <button type="button" title="Insert image" className={toolBtn} onClick={addImage}>
          <ImageIcon size={14} />
        </button>
        <span className="mx-1 h-5 w-px bg-stone-200" aria-hidden />
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) insert(e.target.value);
          }}
          className="h-7 rounded border border-stone-200 bg-white px-1.5 text-xs text-stone-600 focus:border-brand-600 focus:outline-none"
          title="Insert a merge field"
        >
          <option value="">Insert merge field…</option>
          {EMAIL_MERGE_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="ml-auto flex items-center gap-2">
          <LiveDictateButton targetId={areaId} />
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              preview
                ? "border-brand-600 bg-brand-50 text-brand-800"
                : "border-stone-300 text-stone-600 hover:border-brand-600 hover:text-brand-700"
            }`}
          >
            <Eye size={14} weight="bold" /> Preview
          </button>
        </span>
      </div>
      <textarea
        id={areaId}
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onInput={(e) => setValue((e.target as HTMLTextAreaElement).value)}
        onFocus={trackMergeFocus}
        required
        className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm leading-relaxed focus:border-brand-600 focus:outline-none"
      />
      {preview && (
        <div className="rounded-lg border border-stone-200 bg-stone-100 p-4">
          <div className="mx-auto max-w-md rounded-lg bg-white p-5 shadow-sm">
            <div
              className="rounded-t-md bg-[#0b6a40] px-4 py-2 text-sm font-bold text-white"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Your workspace
            </div>
            <div
              className="px-1 py-3 text-[15px]"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: renderLiteMarkdown escapes all input before adding formatting tags.
              dangerouslySetInnerHTML={{
                __html: renderLiteMarkdown(value || "Nothing yet — start typing."),
              }}
            />
            <p className="border-t border-stone-100 pt-2 text-[11px] text-stone-400">
              Merge fields fill from the transaction when sent.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
