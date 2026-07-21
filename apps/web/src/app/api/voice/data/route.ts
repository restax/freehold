import { NextResponse } from "next/server";
import { getPlatformSettings } from "@/lib/platform-settings";
import { verifyVoiceGrant } from "@/lib/voice-grant";
import { briefForScope, runVoiceTool, toolsForScope } from "@/lib/voice-tools";

export const dynamic = "force-dynamic";

/**
 * The only way the voice agent reads Freehold data. Authority comes entirely
 * from the signed grant minted when the session opened — never from anything
 * the agent asserts. A forged, tampered, or expired grant gets 401 and no
 * fallback scope.
 *
 * GET returns the tool catalogue for the grant's scope (a portal visitor and
 * a signed-in coordinator get different tools), the persona, AND the
 * STT/TTS model to use — every scope, not just marketing, since that's a
 * pipeline setting, not a persona one. An operator changing it in
 * /admin/settings takes effect on the very next session fetched here, no
 * agent redeploy needed. POST runs one tool.
 */

function grantFrom(req: Request): string | null {
  const header = req.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function GET(req: Request) {
  const scope = verifyVoiceGrant(grantFrom(req));
  if (!scope) return NextResponse.json({ error: "invalid_grant" }, { status: 401 });
  // Persona and opening line come from here too, so the agent stays generic and
  // the copy lives with the rest of the product's voice.
  const [tools, brief, settings] = await Promise.all([
    toolsForScope(scope),
    briefForScope(scope),
    getPlatformSettings(),
  ]);
  return NextResponse.json({
    tools,
    ...brief,
    sttModel: settings.voiceSttModel,
    ttsModel: settings.voiceTtsModel,
  });
}

export async function POST(req: Request) {
  const scope = verifyVoiceGrant(grantFrom(req));
  if (!scope) return NextResponse.json({ error: "invalid_grant" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    tool?: string;
    input?: Record<string, unknown>;
  } | null;
  if (!body?.tool) return NextResponse.json({ error: "tool_required" }, { status: 400 });

  // Only tools this scope actually publishes may run — a portal grant can't
  // invoke a workspace-wide tool by naming it.
  const tools = await toolsForScope(scope);
  if (!tools.some((t) => t.name === body.tool)) {
    return NextResponse.json({ error: "unknown_tool" }, { status: 400 });
  }

  const result = await runVoiceTool(scope, body.tool, body.input ?? {});
  return NextResponse.json({ result });
}
