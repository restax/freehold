import { NextResponse } from "next/server";
import { buildNylasAuthUrl, nylasEnabled } from "@/lib/nylas";
import { nylasCallbackUri, signNylasState } from "@/lib/nylas-state";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Starts the connect flow: signs who's asking, then hands off to Nylas. */
export async function GET(req: Request) {
  const { userId } = await requireTenant({ allowGuest: true });
  if (!nylasEnabled()) {
    return NextResponse.redirect(new URL("/dashboard/profile?nylas=unconfigured", req.url), 303);
  }
  const redirectUri = nylasCallbackUri(req.url);
  return NextResponse.redirect(
    buildNylasAuthUrl({ redirectUri, state: signNylasState(userId) }),
    303,
  );
}
