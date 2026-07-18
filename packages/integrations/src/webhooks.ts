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
  attempts: number;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Deliver one event to many endpoints. Never throws; failures are reported.
 * Each endpoint gets up to `attempts` tries with backoff; the signature is
 * re-stamped per attempt so timestamp tolerance holds across retries.
 */
export async function deliverWebhooks(
  targets: WebhookTarget[],
  event: string,
  data: unknown,
  options: { attempts?: number; backoffMs?: number[] } = {},
): Promise<DeliveryResult[]> {
  const attempts = options.attempts ?? 3;
  const backoffMs = options.backoffMs ?? [1000, 5000];
  const payload: WebhookEvent = { event, createdAt: new Date().toISOString(), data };
  const body = JSON.stringify(payload);
  return Promise.all(
    targets.map(async (target): Promise<DeliveryResult> => {
      let last: DeliveryResult = { endpointId: target.id, ok: false, attempts: 0 };
      for (let attempt = 1; attempt <= attempts; attempt++) {
        if (attempt > 1) await sleep(backoffMs[Math.min(attempt - 2, backoffMs.length - 1)] ?? 0);
        const timestamp = Math.floor(Date.now() / 1000);
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
          last = { endpointId: target.id, ok: res.ok, status: res.status, attempts: attempt };
          // Retry server errors and timeouts; don't retry 4xx (bad endpoint config).
          if (res.ok || (res.status >= 400 && res.status < 500)) return last;
        } catch (err) {
          last = { endpointId: target.id, ok: false, attempts: attempt, error: String(err) };
        }
      }
      return last;
    }),
  );
}
