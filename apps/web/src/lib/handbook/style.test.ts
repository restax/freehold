import { describe, expect, it } from "vitest";
import { DEFAULT_SUMMARY_STYLE, resolveSummaryStyle } from "./style";

describe("resolveSummaryStyle", () => {
  it("falls back to the bundled default when there is no override", () => {
    // The point of shipping it as a source file: a self-hosted install with
    // an empty settings row still gets a usable style.
    expect(resolveSummaryStyle(null)).toBe(DEFAULT_SUMMARY_STYLE);
    expect(resolveSummaryStyle(undefined)).toBe(DEFAULT_SUMMARY_STYLE);
  });

  it("treats a blank or whitespace override as no override", () => {
    // Clearing the admin textarea is how you ask for the default back, so it
    // must not send an empty style to the model.
    expect(resolveSummaryStyle("")).toBe(DEFAULT_SUMMARY_STYLE);
    expect(resolveSummaryStyle("   \n\t ")).toBe(DEFAULT_SUMMARY_STYLE);
  });

  it("uses the operator's own style when they set one", () => {
    expect(resolveSummaryStyle("  Write in Welsh.  ")).toBe("Write in Welsh.");
  });
});

describe("the default style", () => {
  it("bans the specific slop that makes a daily briefing unreadable", () => {
    // These are the failure mode: a summary can't really be wrong, it can
    // only be so cheerful and padded that people stop reading it.
    for (const banned of ["exclamation", "emoji", "congratulate", "dive into", "leverage"]) {
      expect(DEFAULT_SUMMARY_STYLE.toLowerCase()).toContain(banned);
    }
  });

  it("forbids inventing facts", () => {
    expect(DEFAULT_SUMMARY_STYLE).toMatch(/never invent/i);
  });

  it("keeps it short enough to actually be read", () => {
    expect(DEFAULT_SUMMARY_STYLE).toMatch(/120 words/);
  });

  it("practises what it preaches", () => {
    // A style guide that itself contains an exclamation mark outside a quoted
    // example would be teaching the wrong thing by demonstration.
    const withoutExamples = DEFAULT_SUMMARY_STYLE.replace(/"[^"]*"/g, "");
    expect(withoutExamples).not.toContain("!");
  });
});
