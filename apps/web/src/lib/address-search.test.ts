import { describe, expect, it } from "vitest";
import {
  MIN_QUERY_LENGTH,
  mapboxForwardUrl,
  parseMapboxFeatures,
  shouldSearch,
} from "./address-search";

/** Trimmed from a real Geocode v6 response for "15 Talmuth Ave Haverhill". */
const REAL_FEATURE = {
  properties: {
    mapbox_id: "dXJuOm1ieGFkcjo2ZjY5",
    name: "15 Talmuth Avenue",
    full_address: "15 Talmuth Avenue, Haverhill, Massachusetts 01830, United States",
    context: {
      address: { address_number: "15", street_name: "Talmuth Avenue", name: "15 Talmuth Avenue" },
      postcode: { name: "01830" },
      place: { name: "Haverhill" },
      region: { name: "Massachusetts", region_code: "MA", region_code_full: "US-MA" },
      country: { name: "United States" },
    },
  },
};

describe("shouldSearch", () => {
  it("waits for enough characters to be worth a request", () => {
    expect(shouldSearch("15")).toBe(false);
    expect(shouldSearch("  1  ")).toBe(false);
    expect(shouldSearch("15 ")).toBe(false);
    expect(shouldSearch("15 T")).toBe(true);
    expect("15 T".length).toBeGreaterThanOrEqual(MIN_QUERY_LENGTH);
  });
});

describe("mapboxForwardUrl", () => {
  it("asks for US street addresses in autocomplete mode", () => {
    const url = new URL(mapboxForwardUrl("15 Talmuth", "tok_123"));
    expect(url.origin + url.pathname).toBe("https://api.mapbox.com/search/geocode/v6/forward");
    expect(url.searchParams.get("q")).toBe("15 Talmuth");
    expect(url.searchParams.get("autocomplete")).toBe("true");
    expect(url.searchParams.get("types")).toBe("address");
    expect(url.searchParams.get("country")).toBe("us");
    expect(url.searchParams.get("access_token")).toBe("tok_123");
  });

  it("escapes the query rather than splicing it into the string", () => {
    const url = new URL(mapboxForwardUrl("15 Talmuth & Co #2", "tok"));
    expect(url.searchParams.get("q")).toBe("15 Talmuth & Co #2");
  });
});

describe("parseMapboxFeatures", () => {
  it("splits a real feature into the fields the form needs", () => {
    expect(parseMapboxFeatures({ features: [REAL_FEATURE] })).toEqual([
      {
        id: "dXJuOm1ieGFkcjo2ZjY5",
        label: "15 Talmuth Avenue, Haverhill, MA 01830",
        address: "15 Talmuth Avenue",
        city: "Haverhill",
        state: "MA",
        zip: "01830",
      },
    ]);
  });

  it("uses the two-letter code, not the spelled-out state — the column is 2 chars", () => {
    const [s] = parseMapboxFeatures({ features: [REAL_FEATURE] });
    expect(s.state).toBe("MA");
    expect(s.state.length).toBeLessThanOrEqual(2);
  });

  it("falls back to the state name when Mapbox omits a code", () => {
    const f = structuredClone(REAL_FEATURE);
    f.properties.context.region = { name: "Massachusetts" } as never;
    expect(parseMapboxFeatures({ features: [f] })[0].state).toBe("Massachusetts");
  });

  it("keeps a partial address, leaving unknown parts blank", () => {
    const f = { properties: { name: "412 Maple Avenue", context: {} } };
    expect(parseMapboxFeatures({ features: [f] })).toEqual([
      {
        id: "412 Maple Avenue:0",
        label: "412 Maple Avenue",
        address: "412 Maple Avenue",
        city: "",
        state: "",
        zip: "",
      },
    ]);
  });

  it("skips a feature with no street line rather than offering a blank row", () => {
    expect(parseMapboxFeatures({ features: [{ properties: { context: {} } }] })).toEqual([]);
  });

  it("returns nothing for junk instead of throwing — the response is remote", () => {
    // A Mapbox shape change or an error body must not 500 the picker.
    for (const junk of [
      null,
      undefined,
      {},
      [],
      "nope",
      42,
      { features: null },
      { features: {} },
    ]) {
      expect(parseMapboxFeatures(junk)).toEqual([]);
    }
    expect(parseMapboxFeatures({ features: [null, 7, "x"] })).toEqual([]);
  });
});
