import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { FREEHOLD_FACTS, FREEHOLD_RULES } from "@/lib/freehold-facts";
import { adminAlert } from "@/lib/notify";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are the assistant on freeholdtc.dev, the site for
Freehold. Answer visitor questions briefly, warmly, and honestly — a few
sentences at most.

${FREEHOLD_FACTS}

${FREEHOLD_RULES}`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function sanitize(body: unknown): ChatMessage[] | null {
  if (typeof body !== "object" || body === null) return null;
  const messages = (body as { messages?: unknown }).messages;
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
    return NextResponse.json({ error: "Chat is not available right now." }, { status: 503 });
  }
  const messages = sanitize(await req.json().catch(() => null));
  if (!messages) {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: process.env.FREEHOLD_CHAT_MODEL ?? "claude-opus-4-8",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages,
  });
  const reply = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const lastUser = messages[messages.length - 1]?.content ?? "";
  adminAlert(`💬 Site chat\n> ${lastUser.slice(0, 400)}\n${reply.slice(0, 400)}`);

  return NextResponse.json({ reply });
}
