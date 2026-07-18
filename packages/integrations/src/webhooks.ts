import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Outbound webhooks. Payloads are signed with HMAC-SHA256 over
 * `${timestamp}.${body}` using the endpoint's secret, delivered in the
 * `freehold-signature` header as `t=<unix>,v1=<hex>`.
 *
 * v1 delivery is best-effort (single attempt, 5s timeout). Retries with
 * backoff are on the roadmap; consumers should treat webhooks as hints and
 * reconcile via the REST API.
 */

export interface WebhookTarget {
  id: string;
  url: string;
  secret: string;
}

export interface WebhookEvent {
  event: string;
  createdAt: string;
  data: unknown;
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export function signWebhook(secret: string, timestamp: number, body: string): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

/** Consumer-side helper: verify a `freehold-signature` header. */
export function verifyWebhookSignature(
  secret: string,
  header: string,
  body: string,
  toleranceSeconds = 300,
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=") as [string, string]),
  ) as { t?: string; v1?: string };
  if (!parts.t || !parts.v1) return false;
  const timestamp = Number.parseInt(parts.t, 10);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parts.v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface DeliveryResult {
  endpointId: string;
  ok: boolean;
  status?: number;
  error?: string;
}

/** Deliver one event to many endpoints. Never throws; failures are reported. */
export async function deliverWebhooks(
  targets: WebhookTarget[],
  event: string,
  data: unknown,
): Promise<DeliveryResult[]> {
  const payload: WebhookEvent = { event, createdAt: new Date().toISOString(), data };
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  return Promise.all(
    targets.map(async (target): Promise<DeliveryResult> => {
      try {
        const res = await fetch(target.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "freehold-signature": signWebhook(target.secret, timestamp, body),
            "freehold-event": event,
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
        return { endpointId: target.id, ok: res.ok, status: res.status };
      } catch (err) {
        return { endpointId: target.id, ok: false, error: String(err) };
      }
    }),
  );
}
