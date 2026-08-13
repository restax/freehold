/**
 * Address lookup against Mapbox, split into pure pieces.
 *
 * Every address a coordinator types — a property, a client's mailing address,
 * a brokerage office — goes through this. Typed addresses are the single
 * largest source of junk data in a file: "15 Talmuth" and "15 Talmuth Ave"
 * and "15 talmouth ave" are three different strings for one house, and the
 * misspelling only surfaces when a courier can't find it.
 *
 * Dependency-free (the billing-cadence pattern) so the URL builder and the
 * parser are unit-tested without a network. The parser treats the response as
 * hostile: it's remote JSON, so every level is checked rather than asserted —
 * a shape change at Mapbox should yield zero suggestions, never a 500.
 *
 * Geocoding v6 is deliberate over the Search Box API: it returns structured
 * components (street / city / state / postcode) on the *first* call, so one
 * request fills every field. Search Box needs a second /retrieve round-trip
 * and session-token bookkeeping to get the same thing.
 */

export interface AddressSuggestion {
  /** Mapbox's own id — stable enough for a React key within one response. */
  id: string;
  /** The whole address on one line, as shown in the dropdown. */
  label: string;
  /** Street line alone: "15 Talmuth Avenue". */
  address: string;
  city: string;
  /** Two-letter code ("MA") — the state column is 2 chars. */
  state: string;
  zip: string;
}

const ENDPOINT = "https://api.mapbox.com/search/geocode/v6/forward";

/** Below this, results are noise and every keystroke would bill a request. */
export const MIN_QUERY_LENGTH = 3;

export function shouldSearch(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH;
}

/**
 * Roughly where to rank from, for ranking only.
 *
 * Without it Mapbox has nothing to order a bare street number by, so
 * "1600 Pennsylvania Ave" offers Lorain, Ohio before anywhere a given
 * coordinator has ever worked.
 *
 * This is deliberately *not* the searcher's own location. The first version
 * of this used the request's IP geolocation, which follows the person rather
 * than the market: a Texas coordinator working a file from a hotel in another
 * country got biased towards whatever US addresses were nearest their hotel.
 * The workspace's operating states describe the market, and they don't move
 * when the coordinator does.
 */
export interface Proximity {
  lng: number;
  lat: number;
}

/**
 * Forward-geocode URL for a partial address.
 *
 * `autocomplete` matches on prefixes (the user is still typing), `types=address`
 * keeps whole cities and countries out of a street-address picker, and the
 * token stays server-side — this URL is only ever built in the route handler.
 *
 * `proximity` biases the ranking without filtering: an exact match two states
 * away still comes back, it just stops outranking the one down the road.
 */
export function mapboxForwardUrl(
  query: string,
  token: string,
  opts: { limit?: number; proximity?: Proximity | null } = {},
): string {
  const { limit = 6, proximity = null } = opts;
  const params = new URLSearchParams({
    q: query.trim(),
    access_token: token,
    autocomplete: "true",
    country: "us",
    types: "address",
    limit: String(limit),
  });
  if (proximity) {
    // Three decimals is about 100m: enough to name the right town, coarse
    // enough that we aren't handing Mapbox a doorstep, and repeatable across
    // keystrokes so their cache can do its job.
    const round = (n: number) => Number(n.toFixed(3));
    params.set("proximity", `${round(proximity.lng)},${round(proximity.lat)}`);
  }
  return `${ENDPOINT}?${params}`;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Mapbox response → the suggestions the picker renders. Never throws. */
export function parseMapboxFeatures(payload: unknown): AddressSuggestion[] {
  const features = record(payload).features;
  if (!Array.isArray(features)) return [];

  const out: AddressSuggestion[] = [];
  for (const feature of features) {
    const props = record(record(feature).properties);
    const ctx = record(props.context);
    const region = record(ctx.region);

    // The street line: context.address is the reliable one, but a feature
    // occasionally carries it only as the top-level name.
    const address = text(record(ctx.address).name) || text(props.name);
    if (!address) continue;

    // full_address includes ", United States" — true but useless noise in a
    // domestic-only picker, so the label is rebuilt from the parts.
    const city = text(record(ctx.place).name);
    const state = text(region.region_code) || text(region.name);
    const zip = text(record(ctx.postcode).name);
    const label = [address, city, [state, zip].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");

    out.push({
      id: text(props.mapbox_id) || `${label}:${out.length}`,
      label,
      address,
      city,
      state,
      zip,
    });
  }
  return out;
}
