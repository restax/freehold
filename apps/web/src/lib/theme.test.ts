import { describe, expect, it } from "vitest";
import { contrastRatio, isHex, rgbToHex } from "./color";
import {
  DEFAULT_APPEARANCE,
  PRESET_THEMES,
  parseAppearance,
  resolveAccent,
  THEMES,
  type ThemeKey,
  themeTokens,
} from "./theme";

const ALL_KEYS = Object.keys(THEMES) as ThemeKey[];

/** Every accent a workspace could end up with: the presets, plus a spread of
 *  arbitrary custom colours including the pale ones a picker invites. */
function everyAccent(): Array<{ label: string; a: { theme: ThemeKey; customAccent: string } }> {
  const cases: Array<{ label: string; a: { theme: ThemeKey; customAccent: string } }> =
    PRESET_THEMES.map((theme) => ({
      label: theme as string,
      a: { theme, customAccent: DEFAULT_APPEARANCE.customAccent },
    }));
  for (let r = 0; r < 256; r += 51) {
    for (let g = 0; g < 256; g += 51) {
      for (let b = 0; b < 256; b += 51) {
        const hex = rgbToHex([r, g, b]);
        cases.push({ label: `custom ${hex}`, a: { theme: "custom", customAccent: hex } });
      }
    }
  }
  return cases;
}

describe("parseAppearance", () => {
  it("fills defaults from an empty or absent config", () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance({})).toEqual(DEFAULT_APPEARANCE);
  });

  it("keeps the stored 'forest' key working after the Moss retune", () => {
    // Every existing workspace has theme:"forest" persisted. The label and
    // colours changed; the key deliberately did not, so nothing needed a
    // migration and no workspace silently reverted to a different theme.
    expect(parseAppearance({ theme: "forest" }).theme).toBe("forest");
    expect(THEMES.forest.label).toBe("Moss");
  });

  it("rejects a theme key or colour it doesn't recognise", () => {
    expect(parseAppearance({ theme: "chartreuse" }).theme).toBe("forest");
    expect(parseAppearance({ customAccent: "red" }).customAccent).toBe(
      DEFAULT_APPEARANCE.customAccent,
    );
    // A CSS-injection attempt through the stored config must not survive to
    // reach a style attribute.
    expect(parseAppearance({ customAccent: "#fff;}body{display:none" }).customAccent).toBe(
      DEFAULT_APPEARANCE.customAccent,
    );
  });

  it("round-trips a full config", () => {
    const cfg = {
      theme: "cobalt",
      customAccent: "#123456",
      portalFont: "outfit",
      priorityColors: { HIGH: "#aabbcc", CRITICAL: "#ddeeff" },
      rowHighlight: { scope: "high", color: "#dbeafe" },
    };
    expect(parseAppearance(cfg)).toEqual(cfg);
  });
});

describe("resolveAccent", () => {
  it("uses the table for presets", () => {
    for (const key of PRESET_THEMES) {
      expect(resolveAccent({ theme: key, customAccent: "#000000" })).toEqual({
        accent: THEMES[key].accent,
        dark: THEMES[key].dark,
      });
    }
  });

  it("uses the picked colour for custom, deriving its own dark anchor", () => {
    const { accent, dark } = resolveAccent({ theme: "custom", customAccent: "#2c53b0" });
    expect(accent).toBe("#2c53b0");
    expect(isHex(dark)).toBe(true);
    expect(contrastRatio(dark, "#ffffff")).toBeGreaterThan(contrastRatio(accent, "#ffffff"));
  });

  it("falls back when custom was never given a colour", () => {
    expect(resolveAccent({ theme: "custom", customAccent: "nonsense" }).accent).toBe(
      THEMES.custom.accent,
    );
  });
});

describe("themeTokens", () => {
  it("emits valid hex for every variable, on every theme", () => {
    for (const { label, a } of everyAccent()) {
      for (const [k, v] of Object.entries(themeTokens(a))) {
        expect(isHex(v), `${label} ${k} = ${v}`).toBe(true);
      }
    }
  });

  it("themes the surfaces that used to be hardcoded green", () => {
    // The reported bug: Cobalt recoloured the buttons but the shaded section
    // strips, top bar and address pills stayed green because they were fixed
    // values in globals.css. Each must now differ between two themes.
    const moss = themeTokens({ theme: "forest", customAccent: "#000000" });
    const cobalt = themeTokens({ theme: "cobalt", customAccent: "#000000" });
    for (const key of ["--section-header", "--topbar", "--pill-bg", "--pill-fg"]) {
      expect(moss[key], key).not.toBe(cobalt[key]);
    }
  });

  it("keeps primary-button text readable on its own fill, for any accent", () => {
    for (const { label, a } of everyAccent()) {
      const t = themeTokens(a);
      expect(
        contrastRatio(t["--color-brand-fg"], t["--color-brand-700"]),
        `${label}: button text on fill`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps top-bar text readable on the bar, for any accent", () => {
    for (const { label, a } of everyAccent()) {
      const t = themeTokens(a);
      expect(
        contrastRatio(t["--topbar-fg"], t["--topbar"]),
        `${label}: top-bar text on bar`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps address-pill text readable on the pill, for any accent", () => {
    for (const { label, a } of everyAccent()) {
      const t = themeTokens(a);
      expect(
        contrastRatio(t["--pill-fg"], t["--pill-bg"]),
        `${label}: pill text on pill`,
      ).toBeGreaterThanOrEqual(4.5);
      // The pill also darkens on hover, and the text does not change with it.
      expect(
        contrastRatio(t["--pill-fg"], t["--pill-bg-hover"]),
        `${label}: pill text on hover fill`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps brand-600 links readable on the near-white page, for any accent", () => {
    for (const { label, a } of everyAccent()) {
      const t = themeTokens(a);
      expect(
        contrastRatio(t["--color-brand-600"], "#ffffff"),
        `${label}: link on page`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the section strip light enough for its near-black title text", () => {
    // The strip is a wash, not a fill — dark title text sits on it directly,
    // so a saturated accent must not carry through at full strength.
    for (const { label, a } of everyAccent()) {
      const t = themeTokens(a);
      expect(
        contrastRatio("#292524", t["--section-header"]),
        `${label}: section title on strip`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gives every theme a distinct look", () => {
    const seen = new Map<string, ThemeKey>();
    for (const key of PRESET_THEMES) {
      const sig = themeTokens({ theme: key, customAccent: "#000000" })["--color-brand-600"];
      expect(seen.has(sig), `${key} duplicates ${seen.get(sig)}`).toBe(false);
      seen.set(sig, key);
    }
  });
});

describe("THEMES table", () => {
  it("labels and describes every theme, including custom", () => {
    for (const key of ALL_KEYS) {
      expect(THEMES[key].label.length, key).toBeGreaterThan(0);
      // The hint is the picker's tooltip/subtitle — a swatch alone doesn't
      // say what "Fog" is.
      expect(THEMES[key].hint.length, key).toBeGreaterThan(0);
      expect(isHex(THEMES[key].accent), key).toBe(true);
      expect(isHex(THEMES[key].dark), key).toBe(true);
    }
  });

  it("offers the range asked for: greens, a red, pastels and a near-neutral", () => {
    expect(PRESET_THEMES).toContain("garnet");
    expect(PRESET_THEMES).toContain("sage");
    expect(PRESET_THEMES).toContain("lilac");
    expect(PRESET_THEMES).toContain("fog");
    expect(PRESET_THEMES).not.toContain("custom");
  });
});
