import { NextResponse } from "next/server";
import {
  mapboxForwardUrl,
  parseMapboxFeatures,
  proximityFromHeaders,
  shouldSearch,
} from "@/lib/address-search";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Address suggestions for the address picker.
 *
 * A proxy rather than a client-side Mapbox call, for two reasons. The token
 * stays server-side — `MAPBOX_API_KEY` is not `NEXT_PUBLIC_`, so it is never
 * shipped to a browser and can't be lifted off the page and spent by someone
 * else. And the route requires a session, so this isn't an open geocoding
 * relay billed to our account: anyone wanting free lookups has to sign up
 * first. It deliberately doesn't require a *tenant* — a signed-in vendor or a
 * user mid-onboarding types addresses too, and no tenant data is touched here.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ suggestions: [] }, { status: 401 });

  const query = new URL(req.url).searchParams.get("q") ?? "";
  if (!shouldSearch(query)) return NextResponse.json({ suggestions: [] });

  const token = process.env.MAPBOX_API_KEY;
  // No key configured (a fresh self-host, say) — the picker degrades to a
  // plain text box rather than erroring, so a transaction can still be typed.
  if (!token) return NextResponse.json({ suggestions: [] });

  // Ranking hint only, and absent everywhere the edge doesn't geolocate —
  // see proximityFromHeaders. It never filters, so a coordinator working a
  // file in another state gets the same results, just ordered worse.
  const proximity = proximityFromHeaders(req.headers);

  try {
    const res = await fetch(mapboxForwardUrl(query, token, { proximity }), {
      // Mapbox is a hard dependency of one input, not of the page: a slow or
      // failing geocoder must never hang a coordinator mid-address.
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return NextResponse.json({ suggestions: [] });
    return NextResponse.json({ suggestions: parseMapboxFeatures(await res.json()) });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
