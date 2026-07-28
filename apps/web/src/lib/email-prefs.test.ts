import { describe, expect, it } from "vitest";
import { parseEmailPrefs } from "./email-prefs";

describe("parseEmailPrefs", () => {
  it("defaults every lifecycle email on when nothing is stored", () => {
    expect(parseEmailPrefs(null)).toEqual({ intro: true, postClose: true, review: true });
  });

  it("only an explicit false turns one off — missing keys stay on", () => {
    expect(parseEmailPrefs({ review: false })).toEqual({
      intro: true,
      postClose: true,
      review: false,
    });
  });

  it("respects all three independently", () => {
    expect(parseEmailPrefs({ intro: false, postClose: false, review: false })).toEqual({
      intro: false,
      postClose: false,
      review: false,
    });
  });
});
