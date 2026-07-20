import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { maskKey, parseSkyslopeConfig, partnerConfigured, skyslopeState } from "./skyslope";

const enc = {
  ciphertext: "x",
  iv: "x",
  tag: "x",
  wrappedKey: "x",
  wrapIv: "x",
  wrapTag: "x",
  keyVersion: 1,
};
const stored = { accessKeyEnc: enc, secretEnc: enc, connectedAt: "2026-07-20T00:00:00.000Z" };

describe("parseSkyslopeConfig", () => {
  it("accepts a config carrying both encrypted halves", () => {
    expect(parseSkyslopeConfig(stored)).not.toBeNull();
  });

  it("rejects anything missing either half", () => {
    expect(parseSkyslopeConfig(null)).toBeNull();
    expect(parseSkyslopeConfig({})).toBeNull();
    expect(parseSkyslopeConfig({ accessKeyEnc: enc })).toBeNull();
    expect(parseSkyslopeConfig({ secretEnc: enc })).toBeNull();
  });
});

describe("maskKey", () => {
  it("shows only the last four characters", () => {
    expect(maskKey("ABCD1234EFGH5678")).toBe("••••••••5678");
  });

  it("reveals nothing at all for a short key", () => {
    expect(maskKey("abc")).toBe("••••");
    expect(maskKey("")).toBe("••••");
  });
});

describe("skyslopeState", () => {
  const original = {
    id: process.env.SKYSLOPE_CLIENT_ID,
    secret: process.env.SKYSLOPE_CLIENT_SECRET,
  };
  beforeEach(() => {
    process.env.SKYSLOPE_CLIENT_ID = "partner-id";
    process.env.SKYSLOPE_CLIENT_SECRET = "partner-secret";
  });
  afterEach(() => {
    process.env.SKYSLOPE_CLIENT_ID = original.id;
    process.env.SKYSLOPE_CLIENT_SECRET = original.secret;
  });

  it("reports partner-missing when the install has no agreement, whatever the client stored", () => {
    process.env.SKYSLOPE_CLIENT_ID = "";
    process.env.SKYSLOPE_CLIENT_SECRET = "";
    expect(partnerConfigured()).toBe(false);
    expect(skyslopeState(null)).toBe("partner-missing");
    expect(skyslopeState(stored)).toBe("partner-missing");
  });

  it("distinguishes not-connected from stored", () => {
    expect(skyslopeState(null)).toBe("not-connected");
    expect(skyslopeState(stored)).toBe("stored");
  });

  it("only reports verified once a live call has actually succeeded", () => {
    // Storing a key proves nothing about whether it works.
    expect(skyslopeState(stored)).toBe("stored");
    expect(skyslopeState({ ...stored, verifiedAt: "2026-07-20T01:00:00.000Z" })).toBe("verified");
  });
});
