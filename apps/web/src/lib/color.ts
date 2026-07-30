/**
 * Small hex-colour maths for the theming system.
 *
 * Pure and dependency-free on purpose: the theme picker lets a workspace
 * choose *any* accent, so "is this foreground still readable on that
 * background" stops being something you can eyeball on four hand-picked
 * presets and becomes a rule the code has to guarantee. Keeping the maths
 * here means that rule is unit-tested rather than trusted.
 *
 * Everything works in 6-digit hex and returns 6-digit hex, so the values can
 * go straight into a CSS variable, a Prisma JSON column, or an <input
 * type="color"> without conversion at the edges.
 */

export type Rgb = [number, number, number];

/** Near-black used as the dark ink everywhere a light surface needs text. */
export const INK = "#1c1917";
export const WHITE = "#ffffff";

const HEX6 = /^#[0-9a-fA-F]{6}$/;

export function isHex(value: string): boolean {
  return HEX6.test(value);
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * `weight`% of `a` blended into `b` — the same argument order as CSS
 * `color-mix(in srgb, a weight%, b)`, so a value can be read against the
 * stylesheet it replaces. Blending happens in plain sRGB rather than a
 * perceptual space: these are small nudges toward white or ink, where the
 * extra machinery buys nothing visible.
 */
export function mix(a: string, b: string, weight: number): string {
  const w = Math.max(0, Math.min(100, weight)) / 100;
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([ar * w + br * (1 - w), ag * w + bg * (1 - w), ab * w + bb * (1 - w)]);
}

/** WCAG relative luminance. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * White or ink, whichever is more readable on `background`.
 *
 * This is what makes an unrestricted colour picker safe: a hardcoded
 * `text-white` button is unreadable the moment someone picks a pale accent,
 * and pale accents are exactly what people reach for.
 */
export function readableOn(background: string): string {
  return contrastRatio(WHITE, background) >= contrastRatio(INK, background) ? WHITE : INK;
}

/**
 * Darken toward ink until `hex` clears `min` contrast against `against`.
 *
 * The workhorse for "keep the chosen hue, but make it usable": a picked
 * accent may be far too pale to sit on the near-white page, or to carry dark
 * text on a tint derived from it. Deepening it preserves the workspace's
 * colour choice, where refusing it or flipping to flat black would not.
 */
export function darkenUntilReadable(hex: string, min = 4.5, against = WHITE): string {
  let out = hex;
  for (let step = 0; step < 20 && contrastRatio(out, against) < min; step++) {
    out = mix(out, INK, 90);
  }
  return out;
}
