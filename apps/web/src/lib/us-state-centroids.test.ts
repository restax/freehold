import { describe, expect, it } from "vitest";
import { stateCentroid } from "./us-state-centroids";

describe("stateCentroid", () => {
  it("places a state where that state actually is", () => {
    const tx = stateCentroid("TX");
    expect(tx).not.toBeNull();
    // Texas: west of -93, east of -107, and between the Rio Grande and the
    // Panhandle. A sign flip on the longitude would put this in China, which
    // is the failure worth a test rather than the exact decimal.
    expect(tx?.lng).toBeGreaterThan(-107);
    expect(tx?.lng).toBeLessThan(-93);
    expect(tx?.lat).toBeGreaterThan(25);
    expect(tx?.lat).toBeLessThan(37);
  });

  it("covers every state, all of them in North America", () => {
    const codes = [
      "AL",
      "AK",
      "AZ",
      "AR",
      "CA",
      "CO",
      "CT",
      "DE",
      "DC",
      "FL",
      "GA",
      "HI",
      "ID",
      "IL",
      "IN",
      "IA",
      "KS",
      "KY",
      "LA",
      "ME",
      "MD",
      "MA",
      "MI",
      "MN",
      "MS",
      "MO",
      "MT",
      "NE",
      "NV",
      "NH",
      "NJ",
      "NM",
      "NY",
      "NC",
      "ND",
      "OH",
      "OK",
      "OR",
      "PA",
      "RI",
      "SC",
      "SD",
      "TN",
      "TX",
      "UT",
      "VT",
      "VA",
      "WA",
      "WV",
      "WI",
      "WY",
    ];
    for (const code of codes) {
      const point = stateCentroid(code);
      expect(point, `${code} has no centroid`).not.toBeNull();
      // Every US state sits in the western hemisphere and the northern one.
      // This catches a transposed pair (lat in the lng slot) on any row.
      expect(point?.lng, code).toBeLessThan(-66);
      expect(point?.lng, code).toBeGreaterThan(-180);
      expect(point?.lat, code).toBeGreaterThan(18);
      expect(point?.lat, code).toBeLessThan(72);
    }
  });

  it("accepts a code however it was stored", () => {
    expect(stateCentroid("tx")).toEqual(stateCentroid("TX"));
    expect(stateCentroid(" Tx ")).toEqual(stateCentroid("TX"));
  });

  it("returns nothing rather than guessing", () => {
    // A blank column, a territory we hold no point for, a typo: all mean
    // "send no hint", which is the ranking this had before.
    expect(stateCentroid(null)).toBeNull();
    expect(stateCentroid(undefined)).toBeNull();
    expect(stateCentroid("")).toBeNull();
    expect(stateCentroid("PR")).toBeNull();
    expect(stateCentroid("XX")).toBeNull();
    expect(stateCentroid("Texas")).toBeNull();
  });
});
