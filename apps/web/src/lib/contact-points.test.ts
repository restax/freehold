import { describe, expect, it } from "vitest";
import {
  buildExtraContacts,
  formatContactPoint,
  parseContactPoint,
  readContactPoints,
} from "./contact-points";

describe("parseContactPoint", () => {
  it("splits a trailing parenthetical into a label", () => {
    expect(parseContactPoint("214-555-3333 (Voice Mail)")).toEqual({
      value: "214-555-3333",
      label: "Voice Mail",
    });
  });

  it("leaves an unlabelled value alone", () => {
    expect(parseContactPoint("john@doe.com")).toEqual({ value: "john@doe.com", label: "" });
  });

  it("does not mistake a formatted US number for a label", () => {
    // "(312) 555-0101" ends in no bracket, but the leading area code is the
    // shape most likely to trip a naive regex — pin it.
    expect(parseContactPoint("(312) 555-0101")).toEqual({
      value: "(312) 555-0101",
      label: "",
    });
  });

  it("treats a bare parenthetical as a value, not an empty labelled entry", () => {
    expect(parseContactPoint("(555)")).toEqual({ value: "(555)", label: "" });
  });

  it("trims surrounding whitespace", () => {
    expect(parseContactPoint("  555-1234   (Work)  ")).toEqual({
      value: "555-1234",
      label: "Work",
    });
  });
});

describe("formatContactPoint", () => {
  it("round-trips a labelled point", () => {
    const raw = "214-555-3333 (Voice Mail)";
    expect(formatContactPoint(parseContactPoint(raw))).toBe(raw);
  });

  it("round-trips an unlabelled point", () => {
    expect(formatContactPoint(parseContactPoint("john@doe.com"))).toBe("john@doe.com");
  });

  it("drops an empty value even when it carries a label", () => {
    expect(formatContactPoint({ value: "   ", label: "Work" })).toBe("");
  });
});

describe("readContactPoints", () => {
  it("reads the stored shape", () => {
    const extra = { phones: ["214-555-1234", "214-555-3333 (Voice Mail)"], emails: ["a@b.com"] };
    expect(readContactPoints(extra, "phones")).toEqual([
      { value: "214-555-1234", label: "" },
      { value: "214-555-3333", label: "Voice Mail" },
    ]);
    expect(readContactPoints(extra, "emails")).toEqual([{ value: "a@b.com", label: "" }]);
  });

  it("survives null, a non-object, and a missing key", () => {
    expect(readContactPoints(null, "phones")).toEqual([]);
    expect(readContactPoints("nope", "phones")).toEqual([]);
    expect(readContactPoints({ emails: ["a@b.com"] }, "phones")).toEqual([]);
  });

  it("skips blanks and non-strings", () => {
    expect(readContactPoints({ phones: ["", "  ", 5, null, "555"] }, "phones")).toEqual([
      { value: "555", label: "" },
    ]);
  });
});

describe("buildExtraContacts", () => {
  it("formats both sides", () => {
    expect(
      buildExtraContacts(
        [{ value: "555-1234", label: "Mobile" }],
        [{ value: "a@b.com", label: "" }],
      ),
    ).toEqual({ phones: ["555-1234 (Mobile)"], emails: ["a@b.com"] });
  });

  it("returns null when everything is empty, so the column clears", () => {
    expect(buildExtraContacts([], [])).toBeNull();
    expect(buildExtraContacts([{ value: "  ", label: "Work" }], [])).toBeNull();
  });
});
