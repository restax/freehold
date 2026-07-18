import { describe, expect, it } from "vitest";
import { generateWebhookSecret, signWebhook, verifyWebhookSignature } from "./webhooks.js";

describe("webhook signing", () => {
  it("signs and verifies round-trip", () => {
    const secret = generateWebhookSecret();
    const body = JSON.stringify({ event: "transaction.created", data: { id: "t1" } });
    const header = signWebhook(secret, Math.floor(Date.now() / 1000), body);
    expect(verifyWebhookSignature(secret, header, body)).toBe(true);
  });

  it("rejects tampered bodies and wrong secrets", () => {
    const secret = generateWebhookSecret();
    const body = '{"a":1}';
    const header = signWebhook(secret, Math.floor(Date.now() / 1000), body);
    expect(verifyWebhookSignature(secret, header, '{"a":2}')).toBe(false);
    expect(verifyWebhookSignature(generateWebhookSecret(), header, body)).toBe(false);
  });

  it("rejects stale timestamps", () => {
    const secret = generateWebhookSecret();
    const body = "{}";
    const stale = Math.floor(Date.now() / 1000) - 3600;
    const header = signWebhook(secret, stale, body);
    expect(verifyWebhookSignature(secret, header, body)).toBe(false);
  });
});

describe("deliverWebhooks retries", () => {
  it("retries server errors then succeeds, and skips retries on 4xx", async () => {
    const { deliverWebhooks } = await import("./webhooks.js");
    let calls5xx = 0;
    let calls4xx = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("flaky")) {
        calls5xx++;
        return new Response("err", { status: calls5xx < 3 ? 500 : 200 });
      }
      calls4xx++;
      return new Response("nope", { status: 404 });
    }) as typeof fetch;
    try {
      const results = await deliverWebhooks(
        [
          { id: "a", url: "https://example.test/flaky", secret: "s1" },
          { id: "b", url: "https://example.test/gone", secret: "s2" },
        ],
        "transaction.created",
        { id: "t1" },
        { attempts: 3, backoffMs: [1, 1] },
      );
      const flaky = results.find((r) => r.endpointId === "a");
      const gone = results.find((r) => r.endpointId === "b");
      expect(flaky?.ok).toBe(true);
      expect(flaky?.attempts).toBe(3);
      expect(gone?.ok).toBe(false);
      expect(gone?.attempts).toBe(1);
      expect(calls4xx).toBe(1);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
