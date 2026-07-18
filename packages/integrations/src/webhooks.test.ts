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
