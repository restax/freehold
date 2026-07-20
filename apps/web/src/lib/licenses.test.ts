import { describe, expect, it } from "vitest";
import { licenseHealth, licenseValid, normalizeState } from "./licenses";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("licenseHealth", () => {
  const now = d("2026-07-20");

  it("treats no expiry on record as ok", () => {
    expect(licenseHealth(null, now)).toBe("ok");
  });

  it("is ok with more than 60 days of runway", () => {
    expect(licenseHealth(d("2026-12-31"), now)).toBe("ok");
  });

  it("is expiring inside the 60-day window", () => {
    expect(licenseHealth(d("2026-08-01"), now)).toBe("expiring");
  });

  it("is good through the expiry date itself and expired the day after", () => {
    expect(licenseHealth(d("2026-07-20"), now)).toBe("expiring"); // last valid day
    expect(licenseHealth(d("2026-07-19"), now)).toBe("expired");
  });

  it("licenseValid accepts ok and expiring, rejects expired", () => {
    expect(licenseValid(null, now)).toBe(true);
    expect(licenseValid(d("2026-08-01"), now)).toBe(true);
    expect(licenseValid(d("2026-07-01"), now)).toBe(false);
  });
});

describe("normalizeState", () => {
  it("uppercases and trims two-letter codes", () => {
    expect(normalizeState(" tx ")).toBe("TX");
  });

  it("rejects anything that is not two letters", () => {
    expect(normalizeState("Texas")).toBeNull();
    expect(normalizeState("T")).toBeNull();
    expect(normalizeState("")).toBeNull();
    expect(normalizeState("T1")).toBeNull();
  });
});
