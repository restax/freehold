import type { CSSProperties } from "react";
// Relative, not "@/lib/color": this module is unit-tested and vitest runs
// without the Next path aliases.
import { darkenUntilReadable, INK, isHex, mix, readableOn, WHITE } from "./color";

/**
 * The colour/type system, with no database access.
 *
 * Deliberately free of the Prisma import that `lib/appearance.ts` carries:
 * the theme picker and the marketing page's live switcher are client
 * components that need `THEMES` and `themeTokens`, and importing those from a
 * module that also pulls in the database client drags it toward the browser
 * bundle. Read a workspace's stored config through `lib/appearance.ts`; do
 * the colour maths here.
 *
 * Per-workspace look-and-feel. Two independent halves:
 *  - `theme` + `portalFont` restyle the client-facing portal.
 *  - `priorityColors` + `rowHighlight` tint the internal task lists.
 * Everything is optional; missing values fall back to Freehold's defaults
 * (moss green, Geist, amber/red priorities, no row highlight).
 */

export type ThemeKey =
  | "forest"
  | "sage"
  | "clay"
  | "garnet"
  | "cobalt"
  | "lilac"
  | "slate"
  | "fog"
  | "custom";
export type FontKey = "geist" | "fraunces" | "outfit";
export type HighlightScope = "none" | "critical" | "high";

export interface Appearance {
  theme: ThemeKey;
  /** Only meaningful when `theme` is "custom"; kept when switching away so
   *  going back to Custom restores the colour rather than resetting it. */
  customAccent: string;
  portalFont: FontKey;
  priorityColors: { HIGH: string; CRITICAL: string };
  rowHighlight: { scope: HighlightScope; color: string };
}

/**
 * Accent presets. `accent` is the primary; `dark` anchors the deep end of the
 * ramp and the top bar.
 *
 * The greens are deliberately earthy rather than the saturated emerald this
 * started as — they have to sit beside the shaded section strips and the
 * olive address pills, and a bright emerald read as a different, more
 * synthetic product bolted onto those surfaces.
 *
 * The `forest` key is kept (rather than renamed to `moss`) because it is the
 * value already stored for every existing workspace; only its label and
 * colours changed.
 *
 * `custom` carries the fallback used before anyone picks a colour; its real
 * accent comes from `Appearance.customAccent`.
 */
export const THEMES: Record<
  ThemeKey,
  { label: string; hint: string; accent: string; dark: string }
> = {
  forest: {
    label: "Moss",
    hint: "The Freehold default — earthy green",
    accent: "#4e6b3c",
    dark: "#2f4423",
  },
  sage: { label: "Sage", hint: "Soft, muted green", accent: "#6f8a63", dark: "#47593e" },
  clay: { label: "Clay", hint: "Warm terracotta", accent: "#a4552b", dark: "#6d3417" },
  garnet: { label: "Garnet", hint: "Deep red", accent: "#a32f2f", dark: "#6d1d1d" },
  cobalt: { label: "Cobalt", hint: "Classic blue", accent: "#2c53b0", dark: "#1e3a8a" },
  lilac: { label: "Lilac", hint: "Soft, muted purple", accent: "#7a6a9b", dark: "#514568" },
  slate: { label: "Graphite", hint: "Cool neutral grey", accent: "#4f5b6b", dark: "#28313d" },
  fog: {
    label: "Fog",
    hint: "Near-neutral — the lightest option",
    accent: "#7c746e",
    dark: "#4a443f",
  },
  custom: { label: "Custom", hint: "Pick any colour", accent: "#4e6b3c", dark: "#2f4423" },
};

/** Presets shown in the picker, in order. `custom` is rendered separately
 *  because it carries a colour input rather than a fixed swatch. */
export const PRESET_THEMES = (Object.keys(THEMES) as ThemeKey[]).filter((k) => k !== "custom");

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
  customAccent: THEMES.custom.accent,
  portalFont: "geist",
  priorityColors: { HIGH: "#d97706", CRITICAL: "#dc2626" },
  rowHighlight: { scope: "none", color: "#fee2e2" },
};

function hexOr(v: unknown, fallback: string): string {
  return typeof v === "string" && isHex(v) ? v : fallback;
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
    customAccent: hexOr(c.customAccent, DEFAULT_APPEARANCE.customAccent),
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

/* ---------------- CSS-variable bridges ---------------- */

/**
 * The accent/dark pair a theme actually renders with. For a preset that's the
 * table entry; for "custom" the accent is whatever was picked and the dark
 * anchor is derived from it, so one colour input is enough to define a theme.
 */
export function resolveAccent(a: Pick<Appearance, "theme" | "customAccent">): {
  accent: string;
  dark: string;
} {
  if (a.theme !== "custom") {
    const t = THEMES[a.theme];
    return { accent: t.accent, dark: t.dark };
  }
  const accent = isHex(a.customAccent) ? a.customAccent : THEMES.custom.accent;
  return { accent, dark: mix(accent, INK, 55) };
}

/**
 * Every themed CSS variable, as concrete hex.
 *
 * This is the whole theming contract in one place. It used to be only the
 * `--color-brand-*` ramp, which is why picking Cobalt turned the buttons blue
 * but left the shaded section strips, the top bar and the address pills
 * green: those three lived as hardcoded values in globals.css and nothing
 * connected them to the chosen accent. They are derived here now, so one
 * choice moves every themed surface together.
 *
 * Foregrounds are computed rather than assumed. A workspace can pick any
 * accent from the colour input, including a pale one, and a hardcoded
 * `text-white` would simply vanish on it — so each surface asks for the
 * readable ink for its own background.
 */
export function themeTokens(a: Pick<Appearance, "theme" | "customAccent">): Record<string, string> {
  const { accent, dark } = resolveAccent(a);

  // Ramp: light steps wash the accent into white, deep steps toward the dark
  // anchor. brand-600/700 carry buttons and links, so they also have to stay
  // legible against the near-white page — a pale accent gets deepened rather
  // than refused.
  const brand600 = darkenUntilReadable(accent, 4.5);
  const brand700 = darkenUntilReadable(mix(accent, dark, 60), 4.5);

  // The top bar is dark chrome carrying white text. Blending toward a warm
  // near-black gets there for any normal accent, but a pale custom accent
  // lands it in the mid-grey dead zone where *neither* white nor black
  // reaches 4.5:1 — no choice of foreground can rescue it, so the surface
  // itself is deepened until white text works.
  const topbar = darkenUntilReadable(mix(accent, "#292524", 42), 4.5);
  const pill = mix(accent, WHITE, 18);
  const pillHover = mix(accent, WHITE, 32);

  return {
    "--color-brand-50": mix(accent, WHITE, 8),
    "--color-brand-100": mix(accent, WHITE, 16),
    "--color-brand-200": mix(accent, WHITE, 30),
    "--color-brand-300": mix(accent, WHITE, 48),
    "--color-brand-400": mix(accent, WHITE, 70),
    "--color-brand-500": mix(accent, WHITE, 88),
    "--color-brand-600": brand600,
    "--color-brand-700": brand700,
    "--color-brand-800": mix(accent, dark, 25),
    "--color-brand-900": dark,
    /** Text/icon colour for a filled brand-700 surface (primary buttons). */
    "--color-brand-fg": readableOn(brand700),

    /** SectionCard's shaded title strip — the surface this all started from. */
    "--section-header": mix(accent, WHITE, 10),

    "--topbar": topbar,
    "--topbar-fg": readableOn(topbar),

    /** Address pills. Named for the role, not the colour — they follow the
     *  theme now and are only green on the green themes. */
    "--pill-bg": pill,
    "--pill-bg-hover": pillHover,
    /** Deepened against the *hover* fill, not the resting one: the pill
     *  darkens on hover and the text colour doesn't change with it, so the
     *  darker of the two backgrounds is the binding constraint. */
    "--pill-fg": darkenUntilReadable(mix(accent, INK, 55), 4.5, pillHover),

    "--portal-accent": brand600,
    "--portal-accent-dark": dark,
  };
}

/** The concrete colours an outbound email needs. HTML email can't read CSS
 *  variables reliably, so these are resolved to hex once per send rather
 *  than themed live like the app chrome. */
export interface EmailAccent {
  /** The banner behind the workspace name. */
  header: string;
  /** Text/wordmark colour readable on `header`. */
  headerFg: string;
  /** Links and the contact card's email address, readable on white. */
  link: string;
  /** Pale wash for an explainer/info banner — "why am I getting this". */
  tint: string;
  /** Text colour readable on `tint`. */
  tintFg: string;
}

/**
 * A workspace's theme, resolved for an email. Every branded email used to be
 * hardcoded brand-green — Cobalt workspace, blue app, green email — which is
 * exactly the "one choice moves every surface" property `themeTokens` exists
 * to guarantee for the app chrome. This is that guarantee's email half.
 */
export function resolveEmailAccent(a: Pick<Appearance, "theme" | "customAccent">): EmailAccent {
  // Reuses the app chrome's own top-bar solution rather than re-deriving it:
  // a raw `dark` anchor isn't guaranteed 4.5:1 for white text on a pale
  // custom accent (the same dead zone --topbar exists to escape), and
  // duplicating that fix here would be one more place for it to rot out of
  // sync.
  const tokens = themeTokens(a);
  const tint = tokens["--color-brand-50"];
  return {
    header: tokens["--topbar"],
    headerFg: tokens["--topbar-fg"],
    link: tokens["--color-brand-600"],
    tint,
    // brand-900 is already dark, but a wash this pale is close enough to
    // white that it deserves the same readability guarantee as the topbar
    // rather than an assumption.
    tintFg: darkenUntilReadable(tokens["--color-brand-900"], 4.5, tint),
  };
}

/**
 * Portal root vars: the themed surfaces plus one typeface across the portal —
 * remapping the font utilities used here (font-display hero, font-serif stat
 * numbers) and the inherited base.
 */
export function portalVars(a: Appearance): CSSProperties {
  const font = FONTS[a.portalFont].stack;
  return {
    ...themeTokens(a),
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
