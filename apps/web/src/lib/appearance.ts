import { prisma } from "@freehold/db";
import type { CSSProperties } from "react";

/**
 * Per-workspace look-and-feel. Two independent halves:
 *  - `theme` + `portalFont` restyle the client-facing portal.
 *  - `priorityColors` + `rowHighlight` tint the internal task lists.
 * Everything is optional; missing values fall back to Freehold's defaults
 * (forest green, Geist, amber/red priorities, no row highlight).
 */

export type ThemeKey = "forest" | "cobalt" | "slate" | "clay";
export type FontKey = "geist" | "fraunces" | "outfit";
export type HighlightScope = "none" | "critical" | "high";

export interface Appearance {
  theme: ThemeKey;
  portalFont: FontKey;
  priorityColors: { HIGH: string; CRITICAL: string };
  rowHighlight: { scope: HighlightScope; color: string };
}

/** Portal accent presets. `accent` is the primary; `dark` anchors the header
 *  gradient. Kept tasteful and distinct — one is warm, the rest cool. */
export const THEMES: Record<ThemeKey, { label: string; accent: string; dark: string }> = {
  forest: { label: "Forest", accent: "#0b7a49", dark: "#054f30" },
  cobalt: { label: "Cobalt", accent: "#1d4ed8", dark: "#1e3a8a" },
  slate: { label: "Graphite", accent: "#475569", dark: "#1e293b" },
  clay: { label: "Clay", accent: "#b45309", dark: "#7c2d12" },
};

export const FONTS: Record<FontKey, { label: string; stack: string }> = {
  geist: {
    label: "Geist (clean sans)",
    stack: "var(--font-geist), ui-sans-serif, system-ui, sans-serif",
  },
  fraunces: { label: "Fraunces (elegant serif)", stack: "var(--font-fraunces), Georgia, serif" },
  outfit: {
    label: "Outfit (modern display)",
    stack: "var(--font-outfit), ui-sans-serif, system-ui, sans-serif",
  },
};

/** Swatch palette offered for priority badges — saturated, distinguishable. */
export const PRIORITY_SWATCHES: { label: string; value: string }[] = [
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Amber", value: "#d97706" },
  { label: "Emerald", value: "#059669" },
  { label: "Blue", value: "#2563eb" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Pink", value: "#db2777" },
  { label: "Graphite", value: "#475569" },
];

/** Soft tints for whole-row highlighting — low-saturation so text stays legible. */
export const HIGHLIGHT_SWATCHES: { label: string; value: string }[] = [
  { label: "Rose", value: "#fee2e2" },
  { label: "Amber", value: "#fef3c7" },
  { label: "Blue", value: "#dbeafe" },
  { label: "Violet", value: "#ede9fe" },
  { label: "Emerald", value: "#d1fae5" },
];

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "forest",
  portalFont: "geist",
  priorityColors: { HIGH: "#d97706", CRITICAL: "#dc2626" },
  rowHighlight: { scope: "none", color: "#fee2e2" },
};

const HEX = /^#[0-9a-fA-F]{6}$/;
function hexOr(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v) ? v : fallback;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function parseAppearance(raw: unknown): Appearance {
  const c = (raw ?? {}) as Record<string, unknown>;
  const pc = (c.priorityColors ?? {}) as Record<string, unknown>;
  const rh = (c.rowHighlight ?? {}) as Record<string, unknown>;
  return {
    theme: oneOf(c.theme, Object.keys(THEMES) as ThemeKey[], DEFAULT_APPEARANCE.theme),
    portalFont: oneOf(c.portalFont, Object.keys(FONTS) as FontKey[], DEFAULT_APPEARANCE.portalFont),
    priorityColors: {
      HIGH: hexOr(pc.HIGH, DEFAULT_APPEARANCE.priorityColors.HIGH),
      CRITICAL: hexOr(pc.CRITICAL, DEFAULT_APPEARANCE.priorityColors.CRITICAL),
    },
    rowHighlight: {
      scope: oneOf(rh.scope, ["none", "critical", "high"] as HighlightScope[], "none"),
      color: hexOr(rh.color, DEFAULT_APPEARANCE.rowHighlight.color),
    },
  };
}

export async function tenantAppearance(tenantId: string): Promise<Appearance> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { appearanceConfig: true },
  });
  return parseAppearance(org?.appearanceConfig);
}

/* ---------------- CSS-variable bridges ---------------- */

/**
 * The `--color-brand-*` ramp for a theme, as a plain string map. Tailwind v4
 * compiles `brand-*` utilities to `var(--color-brand-N)`, so applying this map
 * to any element's inline style reskins that whole subtree's brand classes at
 * once — no per-element edits. Derived from the accent (light steps) down to
 * the dark anchor (deep steps) so it stays cohesive for any theme. Returned as
 * a Record (not CSSProperties) so a client can also iterate it via setProperty.
 */
export function brandRamp(theme: ThemeKey): Record<string, string> {
  const { accent, dark } = THEMES[theme];
  const mix = (x: string, y: string, pct: number) => `color-mix(in srgb, ${x} ${pct}%, ${y})`;
  return {
    "--color-brand-50": mix(accent, "white", 8),
    "--color-brand-100": mix(accent, "white", 16),
    "--color-brand-200": mix(accent, "white", 30),
    "--color-brand-300": mix(accent, "white", 48),
    "--color-brand-400": mix(accent, "white", 70),
    "--color-brand-500": mix(accent, "white", 88),
    "--color-brand-600": accent,
    "--color-brand-700": mix(accent, dark, 60),
    "--color-brand-800": mix(accent, dark, 25),
    "--color-brand-900": dark,
    "--portal-accent": accent,
    "--portal-accent-dark": dark,
  };
}

/**
 * Portal root vars: the brand ramp (reskins every brand class in the portal)
 * plus one typeface across the portal — remapping the font utilities used here
 * (font-display hero, font-serif stat numbers) and the inherited base.
 */
export function portalVars(a: Appearance): CSSProperties {
  const font = FONTS[a.portalFont].stack;
  return {
    ...brandRamp(a.theme),
    "--font-sans": font,
    "--font-serif": font,
    "--font-display": font,
  } as CSSProperties;
}

/**
 * Dashboard vars for priority badges/flags plus per-priority row-highlight
 * tints. Baking the scope into the vars (color vs. transparent per priority)
 * means a task row only needs its own priority value to highlight correctly —
 * no need to thread the appearance config into every list.
 */
export function priorityVars(a: Appearance): CSSProperties {
  const { scope, color } = a.rowHighlight;
  const critical = scope !== "none" ? color : "transparent";
  const high = scope === "high" ? color : "transparent";
  return {
    "--priority-high": a.priorityColors.HIGH,
    "--priority-critical": a.priorityColors.CRITICAL,
    "--row-highlight-critical": critical,
    "--row-highlight-high": high,
  } as CSSProperties;
}
