import { describe, expect, it } from "vitest";
import { AD_SLOTS_PER_STATE, MAX_AD_STATES, pickAdStates } from "./vendor-ads";

describe("pickAdStates", () => {
  it("uppercases, keeps only real state codes", () => {
    expect(pickAdStates(["il", "Ca", "zz", "hello"], {})).toEqual(["IL", "CA"]);
  });

  it("de-duplicates", () => {
    expect(pickAdStates(["IL", "il", "IL"], {})).toEqual(["IL"]);
  });

  it("drops states whose slots are already full", () => {
    const fill = { IL: AD_SLOTS_PER_STATE, CA: AD_SLOTS_PER_STATE - 1 };
    expect(pickAdStates(["IL", "CA", "NY"], fill)).toEqual(["CA", "NY"]);
  });

  it(`caps at ${MAX_AD_STATES} states`, () => {
    const result = pickAdStates(["IL", "CA", "NY", "TX", "FL", "WA"], {});
    expect(result).toHaveLength(MAX_AD_STATES);
    expect(result).toEqual(["IL", "CA", "NY", "TX"]);
  });

  it("returns empty for no valid input", () => {
    expect(pickAdStates([], {})).toEqual([]);
    expect(pickAdStates(["ZZ", "??"], {})).toEqual([]);
  });

  it("treats a state at capacity as full but one below as available", () => {
    expect(pickAdStates(["NY"], { NY: AD_SLOTS_PER_STATE })).toEqual([]);
    expect(pickAdStates(["NY"], { NY: AD_SLOTS_PER_STATE - 1 })).toEqual(["NY"]);
  });
});
