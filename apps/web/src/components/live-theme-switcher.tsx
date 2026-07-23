"use client";

import { ArrowsClockwise, PaintBrushBroad } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { brandRamp, THEMES, type ThemeKey } from "@/lib/appearance";

const ORDER: ThemeKey[] = ["forest", "cobalt", "slate", "clay"];

/**
 * Marketing demo of the portal-theming feature: the four theme swatches
 * live-repaint the whole page. Applying a theme's brand ramp to a target
 * element (`targetId`, default the page root) overrides `--color-brand-*` for
 * that subtree, so every `brand-*` utility on the page shifts at once — the
 * same mechanism that themes a real client portal. Resets on unmount so the
 * override doesn't leak across client-side navigation.
 */
export function LiveThemeSwitcher({ targetId = "features-root" }: { targetId?: string }) {
  const [active, setActive] = useState<ThemeKey>("forest");

  function apply(theme: ThemeKey) {
    const el = document.getElementById(targetId);
    if (!el) return;
    if (theme === "forest") {
      // Forest is the site's native palette — clear the overrides so the page
      // returns to its exact loaded state rather than a near-identical ramp.
      for (const k of Object.keys(brandRamp("forest"))) el.style.removeProperty(k);
    } else {
      for (const [k, v] of Object.entries(brandRamp(theme))) el.style.setProperty(k, v);
    }
    setActive(theme);
  }

  useEffect(() => {
    return () => {
      const el = document.getElementById(targetId);
      if (!el) return;
      for (const k of Object.keys(brandRamp("forest"))) el.style.removeProperty(k);
    };
  }, [targetId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-600/20 bg-white shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_10px_rgb(41_37_36/0.05)]">
      <div
        className="flex items-center gap-2 px-5 py-3 text-white"
        style={{
          background:
            "radial-gradient(120% 200% at 0% 0%, var(--color-brand-600) 0%, var(--color-brand-800) 100%)",
        }}
      >
        <PaintBrushBroad size={18} weight="fill" aria-hidden />
        <span className="text-sm font-semibold">Brand it in one click</span>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <h3 className="font-display text-lg font-bold tracking-tight">
            Your clients' portal, your colours
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone-500">
            Pick a theme and a font in Settings; the client portal — header, buttons, links —
            repaints instantly.{" "}
            <span className="font-medium text-brand-700">
              Try it below: this whole page changes on the fly.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {ORDER.map((key) => {
            const t = THEMES[key];
            const on = active === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => apply(key)}
                aria-pressed={on}
                title={t.label}
                className={`h-9 w-9 rounded-full ring-2 ring-offset-2 transition ${
                  on ? "ring-stone-900" : "ring-transparent hover:ring-stone-300"
                }`}
                style={{
                  background: `radial-gradient(120% 140% at 50% 0%, ${t.accent} 0%, ${t.dark} 100%)`,
                }}
              >
                <span className="sr-only">{t.label}</span>
              </button>
            );
          })}
          {active !== "forest" && (
            <button
              type="button"
              onClick={() => apply("forest")}
              title="Reset"
              className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            >
              <ArrowsClockwise size={16} aria-hidden />
              <span className="sr-only">Reset to default</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
