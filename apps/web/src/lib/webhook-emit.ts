import { withTenant } from "@freehold/db";
import { deliverWebhooks } from "@freehold/integrations";

/** Every outbound webhook event Freehold can emit (settings UI + API). */
export const WEBHOOK_EVENTS = [
  "transaction.created",
  "task.completed",
  "document.uploaded",
  "envelope.sent",
  "envelope.completed",
  "vendor.order.placed",
  "vendor.order.updated",
  "vendor.order.completed",
] as const;

/**
 * Fire-and-forget webhook dispatch from web mutations. Never blocks or
 * fails the user's action; delivery is best-effort (see integrations pkg).
 */
export async function emitWebhook(tenantId: string, event: string, data: unknown) {
  try {
    const endpoints = await withTenant(tenantId, (tx) =>
      tx.webhookEndpoint.findMany({ where: { active: true, events: { has: event } } }),
    );
    if (endpoints.length > 0) void deliverWebhooks(endpoints, event, data);
  } catch {
    // webhooks must never break the primary action
  }
}
