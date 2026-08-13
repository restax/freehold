import { prisma } from "@freehold/db";
import { NextResponse } from "next/server";
import {
  mapboxForwardUrl,
  type Proximity,
  parseMapboxFeatures,
  shouldSearch,
} from "@/lib/address-search";
import { getSession } from "@/lib/session";
import { optionalTenantId } from "@/lib/tenant";
import { stateCentroid } from "@/lib/us-state-centroids";

export const dynamic = "force-dynamic";

/**
 * Which state to rank results from: the first one this workspace added to its
 * operating states.
 *
 * Ordered by when it was added rather than alphabetically, because the state
 * a workspace sets up first is in practice the one it works most, and
 * alphabetical would hand a Texas-and-Arizona business Arizona for no reason.
 * A workspace covering nothing yet, a vendor, somebody mid-onboarding: all
 * return null and search exactly as it did before any of this existed.
 *
 * Nothing in here is allowed to throw. Everything else in this route already
 * degrades to a plain text box — a missing key, a slow geocoder, a hostile
 * response — and it would be a poor trade to let the lookup that only decides
 * *ordering* be the one thing that can take the input down.
 */
async function workspaceProximity(): Promise<Proximity | null> {
  try {
    const tenantId = await optionalTenantId();
    if (!tenantId) return null;
    const home = await prisma.tenantState.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      select: { state: true },
    });
    return stateCentroid(home?.state);
  } catch (err) {
    console.error("address-search: could not resolve operating states, searching unbiased", err);
    return null;
  }
}

/**
 * Address suggestions for the address picker.
 *
 * A proxy rather than a client-side Mapbox call, for two reasons. The token
 * stays server-side — `MAPBOX_API_KEY` is not `NEXT_PUBLIC_`, so it is never
 * shipped to a browser and can't be lifted off the page and spent by someone
 * else. And the route requires a session, so this isn't an open geocoding
 * relay billed to our account: anyone wanting free lookups has to sign up
 * first. It deliberately doesn't require a *tenant* — a signed-in vendor or a
 * user mid-onboarding types addresses too, and no tenant data is touched here
 * beyond the operating states used to rank the results.
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

  // Ranking hint only. It never filters, so a coordinator working a file two
  // states away still gets it — the nearby one just stops losing to it.
  // Looked up after the cheap exits above so a too-short query costs nothing.
  const proximity = await workspaceProximity();

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
