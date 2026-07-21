import Anthropic from "@anthropic-ai/sdk";

/**
 * Read an unregistered vendor's plain-email reply and propose — never apply —
 * what they mean: accept, decline, schedule (with a time), complete, or just a
 * note. The result is a PROPOSAL a coordinator confirms in one click; nothing
 * here touches the order. Same model/settings discipline as contract extraction.
 */

export const REPLY_MODEL = process.env.FREEHOLD_AI_MODEL ?? "claude-opus-4-8";

export function aiReplyEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export type ReplyKind = "ACCEPT" | "DECLINE" | "SCHEDULE" | "COMPLETE" | "NOTE" | "UNKNOWN";

export interface ParsedReply {
  kind: ReplyKind;
  /** ISO-8601 appointment time for SCHEDULE, else null. */
  appointmentAt: string | null;
  /** One line a coordinator reads at a glance. */
  summary: string;
}

const REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: {
      type: "string",
      enum: ["ACCEPT", "DECLINE", "SCHEDULE", "COMPLETE", "NOTE", "UNKNOWN"],
    },
    appointmentAt: {
      type: ["string", "null"],
      description: "ISO-8601 datetime for a SCHEDULE reply, otherwise null.",
    },
    summary: { type: "string" },
  },
  required: ["kind", "appointmentAt", "summary"],
} as const;

export interface ReplyContext {
  orderType: string;
  currentStatus: string;
  scheduledAt: Date | null;
  now: Date;
}

export async function parseVendorReply(text: string, ctx: ReplyContext): Promise<ParsedReply> {
  const client = new Anthropic();

  const prompt = `You are reading a vendor's email reply about a service order a real estate transaction coordinator placed with them. Classify what the vendor is telling the coordinator, so it can be proposed as a one-click update. A human reviews your output before anything is applied.

Order: "${ctx.orderType}"
Current status: ${ctx.currentStatus}
${ctx.scheduledAt ? `Currently scheduled for: ${ctx.scheduledAt.toISOString()}` : "No appointment set yet."}
The reply was received at: ${ctx.now.toISOString()}

Classify "kind":
- ACCEPT: they agree to do it / acknowledge the order, no specific time.
- DECLINE: they refuse or say they can't take it.
- SCHEDULE: they propose or confirm a specific appointment date/time. Put it in appointmentAt as an ISO-8601 datetime, resolving relative expressions ("Tuesday at 2", "next week") against the received-at time above. Assume the coordinator's local context; if only a date is given, use 09:00. If a day is named without a date, pick the next such day after the received-at time.
- COMPLETE: they say the work is finished/done.
- NOTE: a question, or a message that doesn't change order state.
- UNKNOWN: you genuinely cannot tell.

"summary": one short sentence for the coordinator, e.g. "Wants to schedule Tuesday, Jul 28 at 2:00 PM" or "Declined — booked that week". Never invent details not in the reply.

Reply text:
"""
${text.slice(0, 6000)}
"""`;

  const response = await client.messages.create({
    model: REPLY_MODEL,
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    output_config: {
      format: {
        type: "json_schema",
        schema: REPLY_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to process this reply.");
  }
  const out = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!out) throw new Error(`Model returned no output (stop_reason: ${response.stop_reason}).`);
  return JSON.parse(out) as ParsedReply;
}
