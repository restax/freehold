import { describe, expect, it } from "vitest";
import { isFullName } from "./full-name";

describe("isFullName", () => {
  it("accepts a first and last name", () => {
    expect(isFullName("Jennifer Welch")).toBe(true);
    expect(isFullName("  Jo   Li ")).toBe(true);
    expect(isFullName("María de la Cruz")).toBe(true);
  });
  it("rejects a single word or blank", () => {
    expect(isFullName("Leah")).toBe(false);
    expect(isFullName("   ")).toBe(false);
    expect(isFullName("")).toBe(false);
  });
  it("rejects a name with no letters in a part", () => {
    expect(isFullName("Leah 2")).toBe(false);
    expect(isFullName("- -")).toBe(false);
  });
});
