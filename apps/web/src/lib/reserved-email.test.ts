import { describe, expect, it } from "vitest";
import { isUndeliverableAddress } from "./reserved-email";

describe("isUndeliverableAddress", () => {
  it("catches reserved TLDs", () => {
    expect(isUndeliverableAddress("casey@sunriserealty.example")).toBe(true);
    expect(isUndeliverableAddress("a@foo.test")).toBe(true);
    expect(isUndeliverableAddress("a@foo.invalid")).toBe(true);
  });

  it("catches example.com and friends, which the old TLD-only check missed", () => {
    expect(isUndeliverableAddress("jordan@example.com")).toBe(true);
    expect(isUndeliverableAddress("a@example.org")).toBe(true);
    expect(isUndeliverableAddress("a@example.net")).toBe(true);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isUndeliverableAddress("A@EXAMPLE.COM")).toBe(true);
    expect(isUndeliverableAddress("a@ Example.Com ")).toBe(true);
  });

  it("treats a missing or malformed address as undeliverable", () => {
    expect(isUndeliverableAddress(null)).toBe(true);
    expect(isUndeliverableAddress(undefined)).toBe(true);
    expect(isUndeliverableAddress("")).toBe(true);
    expect(isUndeliverableAddress("no-at-sign")).toBe(true);
  });

  it("lets real addresses through, including the sample catchall", () => {
    expect(isUndeliverableAddress("sample.buyer@freeholdtc.dev")).toBe(false);
    expect(isUndeliverableAddress("jordan.rivera@gmail.com")).toBe(false);
    expect(isUndeliverableAddress("delivered@resend.dev")).toBe(false);
  });

  it("does not over-match a real domain that merely contains 'example'", () => {
    expect(isUndeliverableAddress("a@examples.com")).toBe(false);
    expect(isUndeliverableAddress("a@myexample.com")).toBe(false);
    expect(isUndeliverableAddress("a@example.co.uk")).toBe(false);
  });
});
