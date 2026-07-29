import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nylasCallbackUri, signNylasState, verifyNylasState } from "./nylas-state";

let saved: string | undefined;

beforeEach(() => {
  saved = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "test-secret";
});

afterEach(() => {
  if (saved === undefined) delete process.env.BETTER_AUTH_SECRET;
  else process.env.BETTER_AUTH_SECRET = saved;
  vi.useRealTimers();
});

describe("nylas state round trip", () => {
  it("returns the user it was signed for", () => {
    expect(verifyNylasState(signNylasState("user_abc"))).toBe("user_abc");
  });

  it("survives a user id containing dots", () => {
    // The encoding splits on the last dot, so an id with its own dots has to
    // still come back whole.
    expect(verifyNylasState(signNylasState("a.b.c"))).toBe("a.b.c");
  });
});

describe("nylas state rejects what it should", () => {
  it("rejects a state signed with a different secret", () => {
    // This is the attack that matters: attaching your mailbox to someone
    // else's account by forging the only thing that names the user.
    const forged = signNylasState("victim");
    process.env.BETTER_AUTH_SECRET = "other-secret";
    expect(verifyNylasState(forged)).toBe(null);
  });

  it("rejects a tampered user id carrying a valid signature", () => {
    // Swap the body for another user while keeping the signature that was
    // issued for the original — the MAC covers the body, so this must fail.
    const signed = signNylasState("user_abc");
    const sig = signed.slice(signed.lastIndexOf(".") + 1);
    const forgedBody = Buffer.from(`attacker.${Date.now()}`).toString("base64url");
    expect(verifyNylasState(`${forgedBody}.${sig}`)).toBe(null);
  });

  it("rejects a state older than the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T00:00:00Z"));
    const signed = signNylasState("user_abc");
    vi.setSystemTime(new Date("2026-07-29T00:16:00Z"));
    expect(verifyNylasState(signed)).toBe(null);
  });

  it("accepts a state still inside the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T00:00:00Z"));
    const signed = signNylasState("user_abc");
    vi.setSystemTime(new Date("2026-07-29T00:14:00Z"));
    expect(verifyNylasState(signed)).toBe("user_abc");
  });

  it("is safe on junk input", () => {
    for (const bad of [null, "", "nodot", ".", "....", "!!!.!!!"]) {
      expect(verifyNylasState(bad)).toBe(null);
    }
  });

  it("rejects everything when the secret is unset", () => {
    const signed = signNylasState("user_abc");
    delete process.env.BETTER_AUTH_SECRET;
    expect(verifyNylasState(signed)).toBe(null);
  });
});

describe("nylasCallbackUri", () => {
  it("keeps the origin of the request it came from", () => {
    // Dev and production each need their own, and it has to match byte for
    // byte between the auth request and the token exchange.
    expect(nylasCallbackUri("http://localhost:3010/api/nylas/connect")).toBe(
      "http://localhost:3010/api/nylas/callback",
    );
    expect(nylasCallbackUri("https://freeholdtc.dev/api/nylas/connect?x=1")).toBe(
      "https://freeholdtc.dev/api/nylas/callback",
    );
  });
});
