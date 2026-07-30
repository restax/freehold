import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  darkenUntilReadable,
  hexToRgb,
  INK,
  isHex,
  mix,
  readableOn,
  relativeLuminance,
  rgbToHex,
  WHITE,
} from "./color";

describe("hex <-> rgb", () => {
  it("round-trips", () => {
    for (const h of ["#000000", "#ffffff", "#4e6b3c", "#2c53b0"]) {
      expect(rgbToHex(hexToRgb(h))).toBe(h);
    }
  });

  it("clamps out-of-range channels rather than emitting invalid hex", () => {
    expect(rgbToHex([-20, 300, 128])).toBe("#00ff80");
  });

  it("accepts a leading # or not", () => {
    expect(hexToRgb("4e6b3c")).toEqual(hexToRgb("#4e6b3c"));
  });
});

describe("isHex", () => {
  it("accepts 6-digit hex only", () => {
    expect(isHex("#4e6b3c")).toBe(true);
    expect(isHex("#4E6B3C")).toBe(true);
    // The colour input and the stored config both use 6 digits; anything else
    // would reach a CSS variable unvalidated.
    expect(isHex("#fff")).toBe(false);
    expect(isHex("red")).toBe(false);
    expect(isHex("")).toBe(false);
    expect(isHex("#4e6b3c;background:url(x)")).toBe(false);
  });
});

describe("mix", () => {
  it("takes weight% of the first colour, like color-mix", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 100)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 50)).toBe("#808080");
  });

  it("clamps weights outside 0–100", () => {
    expect(mix("#000000", "#ffffff", -50)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 150)).toBe("#000000");
  });
});

describe("relativeLuminance", () => {
  it("spans black to white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("contrastRatio", () => {
  it("is 21:1 for black on white and 1:1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#4e6b3c", "#4e6b3c")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#4e6b3c", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#4e6b3c"), 5);
  });
});

describe("readableOn", () => {
  it("picks white on dark and ink on light", () => {
    expect(readableOn("#1c1917")).toBe(WHITE);
    expect(readableOn("#2f4423")).toBe(WHITE);
    expect(readableOn("#ffffff")).toBe(INK);
    expect(readableOn("#f5f5f4")).toBe(INK);
  });

  it("always returns the better of the two, for any colour", () => {
    // The picker allows any accent, so this must hold generally rather than
    // for a handful of presets.
    for (let r = 0; r < 256; r += 51) {
      for (let g = 0; g < 256; g += 51) {
        for (let b = 0; b < 256; b += 51) {
          const bg = rgbToHex([r, g, b]);
          const fg = readableOn(bg);
          const other = fg === WHITE ? INK : WHITE;
          expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(contrastRatio(other, bg));
        }
      }
    }
  });

  it("cannot reach 4.5:1 on mid-grey — the reason surfaces get deepened", () => {
    // Around #777 neither white nor black clears the AA body floor: the best
    // available is ~4.48:1. No choice of foreground fixes it, which is why
    // themeTokens darkens the top bar rather than relying on readableOn to
    // rescue a pale accent. Pinning the number here so that constraint stays
    // visible if anyone revisits it.
    const worst = Math.min(
      ...Array.from({ length: 256 }, (_, r) => {
        const bg = rgbToHex([r, r, r]);
        return contrastRatio(readableOn(bg), bg);
      }),
    );
    expect(worst).toBeGreaterThan(4.1);
    expect(worst).toBeLessThan(4.5);
  });
});

describe("darkenUntilReadable", () => {
  it("leaves an already-readable colour alone", () => {
    expect(darkenUntilReadable("#4e6b3c")).toBe("#4e6b3c");
  });

  it("deepens a pale colour until it clears the floor on white", () => {
    const out = darkenUntilReadable("#fde047");
    expect(contrastRatio(out, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it("terminates and clears the floor for every colour, including white", () => {
    for (let r = 0; r < 256; r += 51) {
      for (let g = 0; g < 256; g += 51) {
        for (let b = 0; b < 256; b += 51) {
          const out = darkenUntilReadable(rgbToHex([r, g, b]));
          expect(contrastRatio(out, WHITE)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("can target a background other than white", () => {
    // How the address pill's text is derived: it must clear the floor on the
    // darker hover fill, not on the page.
    const pillHover = "#c9d6bd";
    const out = darkenUntilReadable("#8aa77a", 4.5, pillHover);
    expect(contrastRatio(out, pillHover)).toBeGreaterThanOrEqual(4.5);
  });
});
