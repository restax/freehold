"use client";

import { useState } from "react";
import { PRESET_THEMES, THEMES, type ThemeKey, themeTokens } from "@/lib/theme";

/**
 * The colour-theme picker.
 *
 * Every option renders as a miniature of the real thing — a card with its
 * shaded title strip and a primary button — rather than a gradient chip. The
 * strip is the surface people are actually choosing between, and a chip of
 * the raw accent doesn't show it: the accent is saturated, the strip derived
 * from it is a pale wash, and picking by chip meant guessing.
 *
 * Client-side so the Custom swatch can repaint while you drag the colour
 * input. The presets would work as plain server-rendered radios, but keeping
 * them in the same component means one selected-state style and one preview
 * layout instead of two that drift.
 */
export function ThemeChoice({ value, customAccent }: { value: ThemeKey; customAccent: string }) {
  const [theme, setTheme] = useState<ThemeKey>(value);
  const [accent, setAccent] = useState(customAccent);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {PRESET_THEMES.map((key) => (
        <ThemeTile
          key={key}
          themeKey={key}
          label={THEMES[key].label}
          hint={THEMES[key].hint}
          tokens={themeTokens({ theme: key, customAccent: accent })}
          checked={theme === key}
          onSelect={() => setTheme(key)}
        />
      ))}

      <ThemeTile
        themeKey="custom"
        label={THEMES.custom.label}
        hint={THEMES.custom.hint}
        tokens={themeTokens({ theme: "custom", customAccent: accent })}
        checked={theme === "custom"}
        onSelect={() => setTheme("custom")}
      >
        {/* Submitted regardless of which theme is selected, so switching to a
            preset and back doesn't lose the mixed colour. */}
        <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
          <input
            type="color"
            name="customAccent"
            value={accent}
            title="Pick any accent colour"
            onChange={(e) => {
              setAccent(e.target.value);
              setTheme("custom");
            }}
            className="h-7 w-9 cursor-pointer rounded border border-stone-300 bg-white p-0.5"
          />
          <span className="font-mono uppercase">{accent}</span>
        </label>
      </ThemeTile>
    </div>
  );
}

function ThemeTile({
  themeKey,
  label,
  hint,
  tokens,
  checked,
  onSelect,
  children,
}: {
  themeKey: ThemeKey;
  label: string;
  hint: string;
  tokens: Record<string, string>;
  checked: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <label className="cursor-pointer" title={`${label} — ${hint}`}>
      <input
        type="radio"
        name="theme"
        value={themeKey}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span className="block rounded-xl border border-stone-200 p-2 ring-2 ring-transparent transition peer-checked:border-transparent peer-checked:ring-stone-900 peer-focus-visible:ring-stone-400">
        {/* The miniature: shaded strip, hairline, body with a primary button —
            the same three parts as a real SectionCard. */}
        <span className="block overflow-hidden rounded-lg border border-stone-200/80 bg-white">
          <span
            className="flex items-center gap-1.5 border-b border-stone-200/80 px-2 py-1.5"
            style={{ background: tokens["--section-header"] }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: tokens["--color-brand-600"] }}
              aria-hidden
            />
            <span className="text-[11px] font-semibold text-stone-800">Section title</span>
          </span>
          <span className="flex items-center justify-between gap-2 px-2 py-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: tokens["--pill-bg"], color: tokens["--pill-fg"] }}
            >
              12 Oak St
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                background: tokens["--color-brand-700"],
                color: tokens["--color-brand-fg"],
              }}
            >
              Save
            </span>
          </span>
        </span>

        <span className="mt-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-stone-700">{label}</span>
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full"
            style={{ background: tokens["--color-brand-600"] }}
            aria-hidden
          />
        </span>
        <span className="block text-xs leading-snug text-stone-500">{hint}</span>
        {children}
      </span>
    </label>
  );
}
