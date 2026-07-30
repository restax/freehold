import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@freehold/db";
import { usageFrom } from "@/lib/ai/usage";
import { resolveSummaryStyle } from "./style";
import { buildSummaryContext, isStale, type SummaryInput } from "./summary-context";

/**
 * "Today at a glance" — the one place the Handbook uses a model.
 *
 * Everything else in the feature is deterministic on purpose. This is the
 * exception because the job genuinely is prose: turning a pile of dates,
 * tasks and standing instructions into the two sentences a person actually
 * needs before they start. It is also the safest possible use of a model
 * here — it only restates what it was handed, it writes nothing back to any
 * file, and if it produces something useless the cost is a dull paragraph.
 */

export interface SummaryResult {
  text: string;
  model: string;
}

/**
 * Ask the model for the briefing.
 *
 * Returns null rather than throwing on any failure: this runs in the
 * background after a page has already rendered, so there is nobody to show an
 * error to, and a workspace with a missing API key should simply not have a
 * briefing rather than log an exception every hour.
 */
export async function writeSummary(
  input: SummaryInput,
  opts: { model: string; thinking: boolean; style: string | null },
  now: Date,
): Promise<(SummaryResult & { usage: ReturnType<typeof usageFrom> }) | null> {
  const context = buildSummaryContext(input, now);
  // Nothing to say. Not an error, and not worth a model call — a quiet day is
  // a real answer, and the screen already shows the empty lists.
  if (!context) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: opts.model,
      max_tokens: 700,
      // Off by default. The task is restating supplied facts, so reasoning
      // mostly buys latency on a request a person is waiting behind.
      // Adaptive is only sent for the models that accept it — Haiku 4.5
      // predates that parameter and rejects it.
      ...(opts.thinking && opts.model !== "claude-haiku-4-5"
        ? { thinking: { type: "adaptive" as const } }
        : {}),
      system: resolveSummaryStyle(opts.style),
      messages: [
        {
          role: "user",
          content: `Today is ${now.toISOString().slice(0, 10)}.${
            input.personName ? ` You are writing for ${input.personName}.` : ""
          }\n\n${context}`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) return null;

    return { text, model: opts.model, usage: usageFrom(opts.model, response) };
  } catch {
    return null;
  }
}

/**
 * Write a fresh briefing and cache it against the member.
 *
 * Guarded by a re-read of the timestamp: two tabs opened at once would
 * otherwise both find the cache stale and both pay for a generation.
 */
export async function refreshSummary(
  tenantId: string,
  memberId: string,
  input: SummaryInput,
  now: Date,
): Promise<void> {
  const [member, settings] = await Promise.all([
    prisma.member.findUnique({
      where: { id: memberId },
      select: { handbookSummaryAt: true },
    }),
    prisma.platformSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
      select: { handbookModel: true, handbookThinking: true, handbookStyleGuide: true },
    }),
  ]);
  if (!member || !isStale(member.handbookSummaryAt, now)) return;

  // Claim the slot before the slow call, so a second request arriving during
  // generation sees a fresh timestamp and doesn't start its own.
  await prisma.member.update({
    where: { id: memberId },
    data: { handbookSummaryAt: now },
  });

  const written = await writeSummary(
    input,
    {
      model: settings.handbookModel,
      thinking: settings.handbookThinking,
      style: settings.handbookStyleGuide,
    },
    now,
  );

  if (!written) {
    // Leave the claim in place: a failure shouldn't mean retrying the same
    // broken call on every page load for the next hour.
    return;
  }

  await prisma.member.update({
    where: { id: memberId },
    data: { handbookSummary: written.text, handbookSummaryAt: now },
  });

  const { logAiUsage } = await import("@/lib/ai/usage");
  await logAiUsage(tenantId, "handbook_summary", written.usage);
}
