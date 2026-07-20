import { randomUUID } from "node:crypto";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { isCloud, recordVoiceSession, voiceQuotaState } from "@/lib/plans";
import { liveLink } from "@/lib/portal";
import { requireTenant } from "@/lib/tenant";
import { checkDemoLimit, clientIp } from "@/lib/voice-demo-limit";
import { mintVoiceGrant, type VoiceScope } from "@/lib/voice-grant";

export const dynamic = "force-dynamic";

/**
 * Opens a voice session: creates a LiveKit room carrying a signed capability
 * grant as its metadata, and returns a join token for the browser. The agent
 * worker reads the grant from the room and can then only reach the data that
 * grant describes — it never picks its own scope. See voice-grant.ts.
 */

function config() {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  return url && key && secret ? { url, key, secret } : null;
}

/** wss://x.livekit.cloud → https://x.livekit.cloud, which the REST API wants. */
function httpUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, "http");
}

export async function POST(req: Request) {
  const cfg = config();
  if (!cfg) return NextResponse.json({ error: "not_configured" }, { status: 501 });

  const body = (await req.json().catch(() => ({}))) as { portalToken?: string; demo?: boolean };
  let scope: VoiceScope;
  let identity: string;
  let billTenantId: string | null = null;

  if (body.demo) {
    // Public homepage demo: no session, no customer data, no tenant to bill.
    // Throttled instead, because this one is open to the whole internet.
    const limit = checkDemoLimit(clientIp(req));
    if (!limit.ok) {
      return NextResponse.json(
        {
          error: "demo_limit",
          reason: limit.reason,
          message:
            limit.reason === "cooldown"
              ? "You've just had a turn — give it a few minutes, or start a free trial to keep going."
              : "The demo has hit today's limit. Try the live workspace demo, or start free.",
        },
        { status: 429 },
      );
    }
    scope = { kind: "marketing" };
    identity = `demo-${randomUUID().slice(0, 8)}`;
  } else if (body.portalToken) {
    // Portal visitor: the capability token is the whole authority, exactly as
    // it is for the portal pages themselves.
    const link = await liveLink(body.portalToken);
    if (!link) return NextResponse.json({ error: "link_not_found" }, { status: 404 });
    scope = { kind: "portal", portalToken: body.portalToken };
    identity = `portal-${link.id}`;
    billTenantId = link.tenantId;
  } else {
    const { tenantId, userId, isGuest } = await requireTenant({ allowGuest: true });
    scope = isGuest ? { kind: "guest", tenantId, userId } : { kind: "tenant", tenantId, userId };
    identity = `user-${userId}`;
    billTenantId = tenantId;
  }

  // Metered on Cloud only; the portal's usage bills to the workspace that
  // published the link, since it's their portal and their budget. The public
  // demo has no tenant — it's throttled above instead.
  if (billTenantId) {
    const quota = await voiceQuotaState(billTenantId);
    if (quota.limited) {
      return NextResponse.json(
        { error: "quota_exceeded", used: quota.used, limit: quota.limit, cloud: isCloud() },
        { status: 402 },
      );
    }
  }

  const grant = mintVoiceGrant(scope);
  if (!grant) return NextResponse.json({ error: "not_configured" }, { status: 501 });

  const room = `voice-${randomUUID()}`;
  const rooms = new RoomServiceClient(httpUrl(cfg.url), cfg.key, cfg.secret);
  await rooms.createRoom({
    name: room,
    metadata: JSON.stringify({ grant }),
    emptyTimeout: 60,
    maxParticipants: 2,
  });

  const at = new AccessToken(cfg.key, cfg.secret, { identity, ttl: "30m" });
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

  if (billTenantId) await recordVoiceSession(billTenantId);

  return NextResponse.json({ url: cfg.url, token: await at.toJwt(), room });
}
