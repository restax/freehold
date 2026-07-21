import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifySlackSignature } from "./notify";

const SECRET = "test-signing-secret";

function sign(body: string, timestamp: string, secret = SECRET): string {
  return `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
}

describe("verifySlackSignature", () => {
  const original = process.env.SLACK_SIGNING_SECRET;
  beforeEach(() => {
    process.env.SLACK_SIGNING_SECRET = SECRET;
  });
  afterEach(() => {
    process.env.SLACK_SIGNING_SECRET = original;
  });

  it("accepts a correctly signed, fresh request", () => {
    const body = '{"type":"event_callback"}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(verifySlackSignature(body, { timestamp, signature: sign(body, timestamp) })).toBe(true);
  });

  it("rejects a wrong signature", () => {
    const body = '{"type":"event_callback"}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(
      verifySlackSignature(body, { timestamp, signature: sign(body, timestamp, "wrong-secret") }),
    ).toBe(false);
  });

  it("rejects a signature computed over different content (tampered body)", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign('{"type":"event_callback"}', timestamp);
    expect(verifySlackSignature('{"type":"something_else"}', { timestamp, signature })).toBe(false);
  });

  it("rejects a stale timestamp (replay guard)", () => {
    const body = '{"type":"event_callback"}';
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes old
    expect(
      verifySlackSignature(body, {
        timestamp: staleTimestamp,
        signature: sign(body, staleTimestamp),
      }),
    ).toBe(false);
  });

  it("rejects when the signing secret isn't configured", () => {
    process.env.SLACK_SIGNING_SECRET = "";
    const body = '{"type":"event_callback"}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(verifySlackSignature(body, { timestamp, signature: sign(body, timestamp) })).toBe(false);
  });

  it("rejects missing headers", () => {
    expect(verifySlackSignature("{}", { timestamp: null, signature: "v0=abc" })).toBe(false);
    expect(verifySlackSignature("{}", { timestamp: "123", signature: null })).toBe(false);
  });
});
