import { describe, expect, it } from "vitest";
import { coverageLabel, isStateCode, normalizeCoverage, vendorSlugify } from "./vendor-profile";

describe("normalizeCoverage", () => {
  it("uppercases and validates a state code", () => {
    expect(normalizeCoverage("STATE", "il")).toEqual({ kind: "STATE", value: "IL" });
    expect(normalizeCoverage("STATE", " Ca ")).toEqual({ kind: "STATE", value: "CA" });
  });

  it("rejects a non-state code", () => {
    expect(normalizeCoverage("STATE", "ZZ")).toBeNull();
    expect(normalizeCoverage("STATE", "Illinois")).toBeNull();
  });

  it("accepts a 5-digit ZIP and rejects anything else", () => {
    expect(normalizeCoverage("ZIP", "60614")).toEqual({ kind: "ZIP", value: "60614" });
    expect(normalizeCoverage("ZIP", "6061")).toBeNull();
    expect(normalizeCoverage("ZIP", "60614-1234")).toBeNull();
    expect(normalizeCoverage("ZIP", "abcde")).toBeNull();
  });

  it("accepts a reasonable county string, rejects empty or overlong", () => {
    expect(normalizeCoverage("COUNTY", "Cook County, IL")).toEqual({
      kind: "COUNTY",
      value: "Cook County, IL",
    });
    expect(normalizeCoverage("COUNTY", "x")).toBeNull();
    expect(normalizeCoverage("COUNTY", "a".repeat(81))).toBeNull();
  });

  it("rejects an unknown kind", () => {
    expect(normalizeCoverage("PLANET", "Mars")).toBeNull();
  });
});

describe("isStateCode", () => {
  it("is case-insensitive", () => {
    expect(isStateCode("ny")).toBe(true);
    expect(isStateCode("NY")).toBe(true);
    expect(isStateCode("DC")).toBe(true);
    expect(isStateCode("XX")).toBe(false);
  });
});

describe("coverageLabel", () => {
  it("expands a state code to its full name", () => {
    expect(coverageLabel("STATE", "TX")).toBe("Texas");
  });
  it("passes county and zip through unchanged", () => {
    expect(coverageLabel("COUNTY", "Cook County, IL")).toBe("Cook County, IL");
    expect(coverageLabel("ZIP", "60614")).toBe("60614");
  });
});

describe("vendorSlugify", () => {
  it("lowercases, hyphenates, and trims", () => {
    expect(vendorSlugify("Acme Title & Escrow")).toBe("acme-title-escrow");
    expect(vendorSlugify("  Spaced   Out  ")).toBe("spaced-out");
  });

  it("caps length and never leaves a trailing hyphen", () => {
    const slug = vendorSlugify("A".repeat(60));
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("falls back to 'vendor' when nothing survives", () => {
    expect(vendorSlugify("!!!")).toBe("vendor");
    expect(vendorSlugify("")).toBe("vendor");
  });
});
