import { describe, expect, it } from "vitest";
import { clientIp, flagEmailCopy, hashFlagToken, newFlagToken } from "./account-flag";

describe("clientIp", () => {
  it("takes the first forwarded hop", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(clientIp(h)).toBe("203.0.113.9");
  });
  it("falls back to x-real-ip, then null", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(new Headers())).toBeNull();
    expect(clientIp(null)).toBeNull();
  });
});

describe("flag token", () => {
  it("hashes deterministically and never stores the token itself", () => {
    const { token, hash } = newFlagToken();
    expect(hash).toBe(hashFlagToken(token));
    expect(hash).not.toContain(token);
    expect(newFlagToken().token).not.toBe(token);
  });
});

describe("flagEmailCopy", () => {
  it("names both ways back in and carries the link", () => {
    const { subject, text } = flagEmailCopy({ name: "Lisa", verifyUrl: "https://x.test/v/abc" });
    expect(subject).toMatch(/Freehold/);
    expect(text).toContain("https://x.test/v/abc");
    expect(text).toMatch(/credit card/i);
    expect(text).toMatch(/Reply to this email/);
    expect(text).not.toContain("—");
  });
});
