import { prisma } from "@freehold/db";

/** Token usage from a single Anthropic call, plus the model that produced it. */
export interface AiUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Pull token counts off an Anthropic response, defaulting missing fields to 0. */
export function usageFrom(
  model: string,
  res: { usage?: { input_tokens?: number | null; output_tokens?: number | null } | null },
): AiUsage {
  return {
    model,
    inputTokens: res.usage?.input_tokens ?? 0,
    outputTokens: res.usage?.output_tokens ?? 0,
  };
}

/** A tenant's override wins when set (non-blank); otherwise the platform default. */
export function resolveModel(override: string | null | undefined, fallback: string): string {
  const o = override?.trim();
  return o ? o : fallback;
}

/**
 * Record one AI call's token usage for operator visibility (per-plan cost).
 * Best-effort by design: a logging failure must never fail the extraction or
 * classification the user is waiting on.
 */
export async function logAiUsage(
  tenantId: string,
  feature: string,
  usage: AiUsage,
  transactionId?: string | null,
): Promise<void> {
  try {
    await prisma.aiUsageEvent.create({
      data: {
        tenantId,
        feature,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        ...(transactionId ? { transactionId } : {}),
      },
    });
  } catch {
    // Swallow — usage telemetry is never worth failing a user operation over.
  }
}

export interface TenantUsage {
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

/**
 * Token usage per tenant over a recent window, for the operator cost panel.
 * Aggregated in the database; tenants with no AI activity are simply absent
 * from the map.
 */
export async function usageByTenant(sinceDays = 30): Promise<Map<string, TenantUsage>> {
  const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000);
  const rows = await prisma.aiUsageEvent.groupBy({
    by: ["tenantId"],
    where: { createdAt: { gte: since } },
    _sum: { inputTokens: true, outputTokens: true },
    _count: { _all: true },
  });
  const map = new Map<string, TenantUsage>();
  for (const r of rows) {
    map.set(r.tenantId, {
      inputTokens: r._sum.inputTokens ?? 0,
      outputTokens: r._sum.outputTokens ?? 0,
      calls: r._count._all,
    });
  }
  return map;
}

export interface FeatureUsage {
  feature: string;
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

/**
 * Usage split by feature, newest window first.
 *
 * Added when the Handbook briefing landed, because it changed the shape of
 * the bill: extraction is a spike when someone uploads a contract, whereas a
 * briefing recurs per person per hour whether or not anyone does anything.
 * A single total hides which of those is growing.
 */
export async function usageByFeature(sinceDays = 30): Promise<FeatureUsage[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000);
  const rows = await prisma.aiUsageEvent.groupBy({
    by: ["feature"],
    where: { createdAt: { gte: since } },
    _sum: { inputTokens: true, outputTokens: true },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({
      feature: r.feature,
      inputTokens: r._sum.inputTokens ?? 0,
      outputTokens: r._sum.outputTokens ?? 0,
      calls: r._count._all,
    }))
    .sort((a, b) => b.calls - a.calls);
}
