import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, loadMasterKey } from "./index.js";

const master = randomBytes(32);

describe("envelope encryption", () => {
  it("round-trips a secret", () => {
    const enc = encryptSecret("hunter2-mls-password", master);
    expect(decryptSecret(enc, master)).toBe("hunter2-mls-password");
  });

  it("never stores plaintext in any field", () => {
    const enc = encryptSecret("super-secret-value", master);
    for (const v of Object.values(enc)) {
      expect(String(v)).not.toContain("super-secret");
    }
  });

  it("produces unique ciphertexts for the same secret (random keys/ivs)", () => {
    const a = encryptSecret("same", master);
    const b = encryptSecret("same", master);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.wrappedKey).not.toBe(b.wrappedKey);
  });

  it("fails closed with the wrong master key", () => {
    const enc = encryptSecret("secret", master);
    expect(() => decryptSecret(enc, randomBytes(32))).toThrow();
  });

  it("fails closed on tampered ciphertext", () => {
    const enc = encryptSecret("secret", master);
    const tampered = { ...enc, ciphertext: Buffer.from("tampered!").toString("base64") };
    expect(() => decryptSecret(tampered, master)).toThrow();
  });
});

describe("loadMasterKey", () => {
  it("accepts a 32-byte base64 key", () => {
    expect(loadMasterKey(randomBytes(32).toString("base64")).length).toBe(32);
  });
  it("rejects missing or short keys", () => {
    expect(() => loadMasterKey(undefined)).toThrow(/not set/);
    expect(() => loadMasterKey(Buffer.from("short").toString("base64"))).toThrow(/32 bytes/);
  });
});
