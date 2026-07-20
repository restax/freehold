import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mintVoiceGrant, type VoiceScope, verifyVoiceGrant } from "./voice-grant";

const TENANT: VoiceScope = { kind: "tenant", tenantId: "t1", userId: "u1" };
const PORTAL: VoiceScope = { kind: "portal", portalToken: "tok123" };

describe("voice grants", () => {
  const original = process.env.BETTER_AUTH_SECRET;
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = "test-secret-value";
  });
  afterEach(() => {
    process.env.BETTER_AUTH_SECRET = original;
  });

  it("round-trips a scope", () => {
    expect(verifyVoiceGrant(mintVoiceGrant(TENANT))).toEqual(TENANT);
    expect(verifyVoiceGrant(mintVoiceGrant(PORTAL))).toEqual(PORTAL);
  });

  it("rejects junk, empties, and missing grants", () => {
    expect(verifyVoiceGrant(null)).toBeNull();
    expect(verifyVoiceGrant("")).toBeNull();
    expect(verifyVoiceGrant("nonsense")).toBeNull();
    expect(verifyVoiceGrant("a.b")).toBeNull();
  });

  it("rejects a tampered payload — the whole point of signing it", () => {
    // Re-encode a *different* scope but keep the original signature.
    const forged = Buffer.from(
      JSON.stringify({
        scope: { kind: "tenant", tenantId: "someone-else" },
        exp: Date.now() + 1000,
      }),
    ).toString("base64url");
    const signature = (mintVoiceGrant(TENANT) as string).split(".")[1];
    expect(verifyVoiceGrant(`${forged}.${signature}`)).toBeNull();
  });

  it("rejects a grant signed with a different secret", () => {
    const grant = mintVoiceGrant(TENANT) as string;
    process.env.BETTER_AUTH_SECRET = "a-completely-different-secret";
    expect(verifyVoiceGrant(grant)).toBeNull();
  });

  it("rejects an expired grant", () => {
    const grant = mintVoiceGrant(TENANT) as string;
    const [payload] = grant.split(".");
    const body = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(body.exp).toBeGreaterThan(Date.now());
    // Signature covers exp, so an expired grant can't be re-dated either.
    const stale = Buffer.from(JSON.stringify({ ...body, exp: Date.now() - 1 })).toString(
      "base64url",
    );
    expect(verifyVoiceGrant(`${stale}.${grant.split(".")[1]}`)).toBeNull();
  });

  it("mints nothing when the signing secret is absent", () => {
    process.env.BETTER_AUTH_SECRET = "";
    expect(mintVoiceGrant(TENANT)).toBeNull();
    expect(verifyVoiceGrant("anything.atall")).toBeNull();
  });
});
