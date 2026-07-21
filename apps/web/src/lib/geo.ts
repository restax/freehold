import { headers } from "next/headers";
import { isStateCode } from "@/lib/vendor-profile";

/**
 * The viewer's US state, inferred from Vercel's edge geolocation headers.
 * `x-vercel-ip-country-region` carries the ISO 3166-2 subdivision code, which
 * for the US is the two-letter state code. We only trust it when the country is
 * US and the value is a real state; otherwise null (callers fall back to a
 * nationwide selection). Set `x-vercel-ip-country`/`-region` locally to test.
 *
 * A signed-in user's own state could override this later; for now the edge geo
 * is the single, privacy-light signal — no lookup, no stored location.
 */
export async function viewerState(): Promise<string | null> {
  const h = await headers();
  const country = h.get("x-vercel-ip-country");
  if (country && country !== "US") return null;
  const region = (h.get("x-vercel-ip-country-region") ?? "").toUpperCase();
  return isStateCode(region) ? region : null;
}
