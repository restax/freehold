import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { liveLink } from "@/lib/portal";
import { requireTenant } from "@/lib/tenant";
import type { VoiceScope } from "@/lib/voice-grant";
import {
  briefForScope,
  extractReferences,
  runVoiceTool,
  toolsForScope,
  turnIsTerminal,
  type VoiceReference,
} from "@/lib/voice-tools";

export const dynamic = "force-dynamic";

/**
 * The typed twin of voice search: same tools, same scope discipline, same
 * per-scope persona — just text in, text out, for people who'd rather type
 * (or can't use a mic). The scope comes from the session or the portal token
 * exactly as /api/voice/token derives it; the model can only reach what that
 * scope's tools already allow, so this widens nothing the voice path didn't.
 *
 * Runs the Claude tool-use loop server-side: the tools' input_schema is
 * already the Anthropic tool shape, so runVoiceTool (the same dispatcher the
 * voice agent relays back to) executes each call under the verified scope.
 */

const MODEL = process.env.FREEHOLD_CHAT_MODEL ?? "claude-opus-4-8";
const MAX_TOOL_TURNS = 4;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function sanitize(messages: unknown): ChatMessage[] | null {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 24) return null;
  const clean: ChatMessage[] = [];
  for (const m of messages) {
    const role = (m as ChatMessage).role;
    const content = (m as ChatMessage).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    if (content.length === 0 || content.length > 2000) return null;
    clean.push({ role, content });
  }
  if (clean[clean.length - 1]?.role !== "user") return null;
  return clean;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as {
    messages?: unknown;
    portalToken?: string;
  } | null;
  const messages = sanitize(body?.messages);
  if (!messages) return NextResponse.json({ error: "invalid" }, { status: 400 });

  // Same scope derivation as /api/voice/token — the typed path is not a way
  // to reach data the voice path can't.
  let scope: VoiceScope;
  if (body?.portalToken) {
    const link = await liveLink(body.portalToken);
    if (!link) return NextResponse.json({ error: "link_not_found" }, { status: 404 });
    scope = { kind: "portal", portalToken: body.portalToken };
  } else {
    const { tenantId, userId, isGuest } = await requireTenant({ allowGuest: true });
    scope = isGuest ? { kind: "guest", tenantId, userId } : { kind: "tenant", tenantId, userId };
  }

  const [tools, brief] = await Promise.all([toolsForScope(scope), briefForScope(scope)]);
  const anthropicTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }));

  const client = new Anthropic();
  const convo: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Accumulated across every tool call this turn: navigateTo is "where the
  // navigate tool sent us" (last call wins, there's only ever meant to be
  // one); references are id+label pairs pulled from data-lookup tool results
  // so the client can turn a matching mention in the reply text into a link.
  let navigateTo: string | undefined;
  const references: VoiceReference[] = [];

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: brief.instructions,
      ...(anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
      messages: convo,
    });

    const said = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (res.stop_reason !== "tool_use") {
      return NextResponse.json({
        reply: said || "I'm not sure how to answer that one.",
        navigateTo,
        references: dedupeReferences(references),
      });
    }

    // Run every tool the model asked for, under the verified scope, and feed
    // the results back for the next turn.
    convo.push({ role: "assistant", content: res.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    const calls = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    for (const block of calls) {
      const result = await runVoiceTool(
        scope,
        block.name,
        (block.input ?? {}) as Record<string, unknown>,
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
      if (block.name === "navigate" && result && typeof result === "object") {
        const navigated = (result as { navigateTo?: unknown }).navigateTo;
        if (typeof navigated === "string") navigateTo = navigated;
      } else {
        references.push(...extractReferences(result));
      }
    }

    // See turnIsTerminal: a turn that only navigated has nothing left to feed
    // back, so finish on the sentence the model already wrote alongside it.
    if (
      turnIsTerminal(
        calls.map((c) => c.name),
        said,
        navigateTo,
      )
    ) {
      return NextResponse.json({
        reply: said,
        navigateTo,
        references: dedupeReferences(references),
      });
    }

    convo.push({ role: "user", content: toolResults });
  }

  // Ran out of tool turns without a final answer — don't leave them hanging.
  return NextResponse.json({
    reply: "That took more steps than I can do at once — try asking it more narrowly.",
    navigateTo,
    references: dedupeReferences(references),
  });
}

/** Last-write-wins by id, capped so a long tool-heavy turn can't balloon the response. */
function dedupeReferences(refs: VoiceReference[]): VoiceReference[] {
  const byId = new Map(refs.map((r) => [r.id, r]));
  return [...byId.values()].slice(0, 30);
}
