import { describe, expect, it } from "vitest";
import { normalizeUsername, usernameFormatError } from "./username";

describe("normalizeUsername", () => {
  it("lowercases and trims", () => {
    expect(normalizeUsername("  SarahM  ")).toBe("sarahm");
  });
});

describe("usernameFormatError", () => {
  it("accepts a well-formed handle", () => {
    expect(usernameFormatError("sarah-m")).toBeNull();
    expect(usernameFormatError("tc123")).toBeNull();
  });

  it("rejects too short / too long", () => {
    expect(usernameFormatError("ab")).toMatch(/at least/i);
    expect(usernameFormatError("a".repeat(31))).toMatch(/at most/i);
  });

  it("rejects illegal characters", () => {
    expect(usernameFormatError("sarah_m")).toMatch(/hyphens/i);
    expect(usernameFormatError("sarah.m")).toMatch(/hyphens/i);
    expect(usernameFormatError("sarah m")).toMatch(/hyphens/i);
  });

  it("rejects leading/trailing and doubled hyphens", () => {
    expect(usernameFormatError("-sarah")).toMatch(/hyphen/i);
    expect(usernameFormatError("sarah-")).toMatch(/hyphen/i);
    expect(usernameFormatError("sa--rah")).toMatch(/double/i);
  });

  it("rejects reserved subdomains and handles", () => {
    expect(usernameFormatError("vendor")).toMatch(/reserved/i);
    expect(usernameFormatError("admin")).toMatch(/reserved/i);
    expect(usernameFormatError("api")).toMatch(/reserved/i);
  });
});
