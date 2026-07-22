import { describe, expect, it } from "vitest";
import { resolveModel, usageFrom } from "./usage";

describe("usageFrom", () => {
  it("reads token counts off an Anthropic response", () => {
    expect(
      usageFrom("claude-opus-4-8", { usage: { input_tokens: 1200, output_tokens: 340 } }),
    ).toEqual({ model: "claude-opus-4-8", inputTokens: 1200, outputTokens: 340 });
  });

  it("defaults missing/null usage fields to zero", () => {
    expect(usageFrom("m", {})).toEqual({ model: "m", inputTokens: 0, outputTokens: 0 });
    expect(usageFrom("m", { usage: null })).toEqual({
      model: "m",
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(usageFrom("m", { usage: { input_tokens: null, output_tokens: 5 } })).toEqual({
      model: "m",
      inputTokens: 0,
      outputTokens: 5,
    });
  });
});

describe("resolveModel", () => {
  it("uses the override when set", () => {
    expect(resolveModel("claude-sonnet-5", "claude-opus-4-8")).toBe("claude-sonnet-5");
  });

  it("falls back on null, undefined, empty, or whitespace override", () => {
    expect(resolveModel(null, "def")).toBe("def");
    expect(resolveModel(undefined, "def")).toBe("def");
    expect(resolveModel("", "def")).toBe("def");
    expect(resolveModel("   ", "def")).toBe("def");
  });

  it("trims a set override", () => {
    expect(resolveModel("  claude-haiku-4-5 ", "def")).toBe("claude-haiku-4-5");
  });
});
