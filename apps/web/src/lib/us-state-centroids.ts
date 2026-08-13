/**
 * A point near the middle of each US state, for biasing address search.
 *
 * Precision is deliberately low. This is a ranking hint, not a location: it
 * exists so "100 Main Street" offers the one in the state a coordinator
 * actually works before the one four states away. Being off by fifty miles
 * inside Texas changes nothing about that job.
 *
 * Dependency-free (the lib/mcp-access.ts pattern) so the lookup is unit-tested
 * without a database or a network.
 */

/** [longitude, latitude] — Mapbox's order, and the order this file stores. */
const CENTROIDS: Record<string, [number, number]> = {
  AL: [-86.79, 32.81],
  AK: [-152.4, 63.59],
  AZ: [-111.66, 34.05],
  AR: [-92.44, 34.97],
  CA: [-119.68, 36.78],
  CO: [-105.31, 39.11],
  CT: [-72.76, 41.6],
  DC: [-77.04, 38.91],
  DE: [-75.51, 38.91],
  FL: [-81.52, 27.77],
  GA: [-83.44, 32.16],
  HI: [-155.58, 19.9],
  IA: [-93.1, 41.88],
  ID: [-114.48, 44.07],
  IL: [-89.4, 40.63],
  IN: [-86.13, 40.27],
  KS: [-98.48, 39.01],
  KY: [-84.27, 37.84],
  LA: [-91.96, 30.98],
  MA: [-71.38, 42.41],
  MD: [-76.64, 39.05],
  ME: [-69.45, 45.25],
  MI: [-85.6, 44.31],
  MN: [-94.64, 46.73],
  MO: [-92.6, 37.96],
  MS: [-89.4, 32.35],
  MT: [-110.36, 46.88],
  NC: [-79.02, 35.76],
  ND: [-101.0, 47.55],
  NE: [-99.9, 41.49],
  NH: [-71.57, 43.19],
  NJ: [-74.41, 40.06],
  NM: [-105.87, 34.52],
  NV: [-116.42, 38.8],
  NY: [-75.5, 42.95],
  OH: [-82.91, 40.42],
  OK: [-97.09, 35.01],
  OR: [-120.55, 43.8],
  PA: [-77.19, 41.2],
  RI: [-71.48, 41.58],
  SC: [-81.16, 33.84],
  SD: [-99.9, 43.97],
  TN: [-86.58, 35.52],
  TX: [-99.9, 31.97],
  UT: [-111.09, 39.32],
  VA: [-78.66, 37.43],
  VT: [-72.58, 44.56],
  WA: [-120.74, 47.75],
  WI: [-89.62, 44.5],
  WV: [-80.45, 38.6],
  WY: [-107.29, 43.08],
};

/**
 * Where to point a search for a workspace working this state.
 *
 * Returns null for anything that isn't a state we know — a blank column, a
 * territory, a typo — so the caller sends no hint at all rather than a
 * confident wrong one.
 */
export function stateCentroid(
  code: string | null | undefined,
): { lng: number; lat: number } | null {
  const key = (code ?? "").trim().toUpperCase();
  const point = CENTROIDS[key];
  return point ? { lng: point[0], lat: point[1] } : null;
}
