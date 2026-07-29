import { prisma } from "@freehold/db";
import { NextResponse } from "next/server";
import { exchangeNylasCode, fetchNylasGrant } from "@/lib/nylas";
import { nylasCallbackUri, verifyNylasState } from "@/lib/nylas-state";

export const dynamic = "force-dynamic";

const PROFILE = "/dashboard/profile";

function back(req: Request, status: string) {
  return NextResponse.redirect(new URL(`${PROFILE}?nylas=${status}`, req.url), 303);
}

/**
 * Where Nylas returns the user after they authorise their mailbox.
 *
 * Deliberately does *not* trust the session for identity — the user id comes
 * out of the signed `state`, so a code can only ever be attached to the
 * account that started the flow, even if this URL is opened from somewhere
 * else entirely.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = url.searchParams;

  // The user declined at the provider, or Nylas rejected the request.
  if (params.get("error")) return back(req, "denied");

  const userId = verifyNylasState(params.get("state"));
  const code = params.get("code");
  if (!userId || !code) return back(req, "invalid");

  try {
    const grantId = await exchangeNylasCode({
      code,
      // Must be byte-identical to the one used at /api/nylas/connect.
      redirectUri: nylasCallbackUri(req.url),
    });
    const info = await fetchNylasGrant(grantId);

    // Upsert on userId: reconnecting, or connecting a different mailbox,
    // replaces the existing row rather than leaving a stale second grant.
    await prisma.nylasGrant.upsert({
      where: { userId },
      create: {
        userId,
        grantId: info.grantId,
        email: info.email,
        provider: info.provider,
        status: info.status,
      },
      update: {
        grantId: info.grantId,
        email: info.email,
        provider: info.provider,
        status: info.status,
        lastError: null,
        connectedAt: new Date(),
      },
    });
    return back(req, "connected");
  } catch {
    // The code is single-use, so there's nothing to retry — send them back to
    // the button to start again.
    return back(req, "failed");
  }
}
