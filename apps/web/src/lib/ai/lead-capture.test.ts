import { describe, expect, it } from "vitest";
import {
  cleanField,
  fullName,
  hasAnyField,
  isSupportedImageType,
  normalizeLead,
} from "./lead-capture";

describe("cleanField", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanField("  Brooke   Hayes ")).toBe("Brooke Hayes");
    expect(cleanField("line\nbreak")).toBe("line break");
  });

  it("turns blank and non-string values into null", () => {
    expect(cleanField("")).toBeNull();
    expect(cleanField("   ")).toBeNull();
    expect(cleanField(null)).toBeNull();
    expect(cleanField(undefined)).toBeNull();
  });
});

describe("normalizeLead", () => {
  it("keeps the five known fields and drops anything else", () => {
    expect(
      normalizeLead({
        firstName: "Brooke",
        lastName: "Hayes",
        phone: "(916) 555-0142",
        email: "brooke@example.com",
        company: "Real Estate by Brooke",
        note: "should be ignored",
      }),
    ).toEqual({
      firstName: "Brooke",
      lastName: "Hayes",
      phone: "(916) 555-0142",
      email: "brooke@example.com",
      company: "Real Estate by Brooke",
    });
  });

  it("nulls every field for garbage input rather than throwing", () => {
    const empty = {
      firstName: null,
      lastName: null,
      phone: null,
      email: null,
      company: null,
    };
    expect(normalizeLead(null)).toEqual(empty);
    expect(normalizeLead(undefined)).toEqual(empty);
    expect(normalizeLead("not an object")).toEqual(empty);
    expect(normalizeLead({ firstName: 42, email: { nested: true } })).toEqual(empty);
  });

  it("handles a business-only page, where there is no person name", () => {
    expect(
      normalizeLead({
        firstName: null,
        lastName: null,
        phone: "916-555-0199",
        email: null,
        company: "Bayside Realty Group",
      }),
    ).toEqual({
      firstName: null,
      lastName: null,
      phone: "916-555-0199",
      email: null,
      company: "Bayside Realty Group",
    });
  });
});

describe("hasAnyField", () => {
  const empty = { firstName: null, lastName: null, phone: null, email: null, company: null };

  it("is false only when the model found nothing at all", () => {
    expect(hasAnyField(empty)).toBe(false);
  });

  it("is true when any single field came back", () => {
    expect(hasAnyField({ ...empty, company: "Bayside Realty Group" })).toBe(true);
    expect(hasAnyField({ ...empty, phone: "916-555-0199" })).toBe(true);
  });
});

describe("fullName", () => {
  it("joins the parts that exist", () => {
    expect(fullName({ firstName: "Brooke", lastName: "Hayes" })).toBe("Brooke Hayes");
    expect(fullName({ firstName: "Brooke", lastName: null })).toBe("Brooke");
    expect(fullName({ firstName: null, lastName: "Hayes" })).toBe("Hayes");
  });

  it("is null when neither part is present, so a company-only lead is detectable", () => {
    expect(fullName({ firstName: null, lastName: null })).toBeNull();
  });
});

describe("isSupportedImageType", () => {
  it("accepts the formats the vision API takes", () => {
    for (const t of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
      expect(isSupportedImageType(t)).toBe(true);
    }
  });

  it("rejects a PDF or an unknown type, so the action can fail cleanly", () => {
    expect(isSupportedImageType("application/pdf")).toBe(false);
    expect(isSupportedImageType("image/heic")).toBe(false);
    expect(isSupportedImageType("")).toBe(false);
  });
});
