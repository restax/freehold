import { describe, expect, it } from "vitest";
import { couponIssue } from "./credit-coupons";

const NOW = Date.parse("2026-07-22T00:00:00Z");
const ok = { expiresAt: null, timesRedeemed: 0, maxRedemptions: 1 };

describe("couponIssue", () => {
  it("returns null for a fresh, unexpired, unused coupon", () => {
    expect(couponIssue(ok, NOW)).toBeNull();
  });

  it("rejects a missing coupon", () => {
    expect(couponIssue(null, NOW)).toBe("That code isn't valid.");
  });

  it("rejects an expired coupon", () => {
    expect(couponIssue({ ...ok, expiresAt: new Date(NOW - 1000) }, NOW)).toBe(
      "That code has expired.",
    );
  });

  it("allows a coupon whose expiry is still in the future", () => {
    expect(couponIssue({ ...ok, expiresAt: new Date(NOW + 1000) }, NOW)).toBeNull();
  });

  it("rejects a fully-redeemed coupon", () => {
    expect(couponIssue({ ...ok, timesRedeemed: 3, maxRedemptions: 3 }, NOW)).toBe(
      "That code has been fully redeemed.",
    );
  });

  it("allows a multi-use coupon with redemptions left", () => {
    expect(couponIssue({ ...ok, timesRedeemed: 2, maxRedemptions: 5 }, NOW)).toBeNull();
  });
});
