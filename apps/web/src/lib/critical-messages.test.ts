import { describe, expect, it } from "vitest";
import { messageIsDue, onboardingAdDue } from "./critical-messages";

const NOW = new Date("2026-08-01T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("messageIsDue", () => {
  it("is always due when the trigger is immediate", () => {
    expect(
      messageIsDue(
        {
          trigger: "IMMEDIATE",
          triggerDelayDays: null,
          hasSampleData: false,
          realTransactionCount: 0,
          afterMessageFirstShownAt: null,
        },
        NOW,
      ),
    ).toBe(true);
  });

  describe("HAS_SAMPLE_DATA", () => {
    const ctx = (hasSampleData: boolean) => ({
      trigger: "HAS_SAMPLE_DATA" as const,
      triggerDelayDays: null,
      hasSampleData,
      realTransactionCount: 0,
      afterMessageFirstShownAt: null,
    });

    it("is due only while the workspace has sample data", () => {
      expect(messageIsDue(ctx(true), NOW)).toBe(true);
      expect(messageIsDue(ctx(false), NOW)).toBe(false);
    });
  });

  describe("FIFTH_REAL_TRANSACTION", () => {
    const ctx = (realTransactionCount: number) => ({
      trigger: "FIFTH_REAL_TRANSACTION" as const,
      triggerDelayDays: null,
      hasSampleData: false,
      realTransactionCount,
      afterMessageFirstShownAt: null,
    });

    it("is not due before the 5th real transaction", () => {
      expect(messageIsDue(ctx(4), NOW)).toBe(false);
    });

    it("is due exactly at the 5th, and stays due after", () => {
      expect(messageIsDue(ctx(5), NOW)).toBe(true);
      expect(messageIsDue(ctx(9), NOW)).toBe(true);
    });
  });

  describe("DAYS_AFTER_MESSAGE", () => {
    const ctx = (delayDays: number | null, firstShownAt: Date | null) => ({
      trigger: "DAYS_AFTER_MESSAGE" as const,
      triggerDelayDays: delayDays,
      hasSampleData: false,
      realTransactionCount: 0,
      afterMessageFirstShownAt: firstShownAt,
    });

    it("is not due before the message it chains from has ever been shown", () => {
      expect(messageIsDue(ctx(5, null), NOW)).toBe(false);
    });

    it("is not due with no delay configured, even if the chained message was shown", () => {
      expect(messageIsDue(ctx(null, daysAgo(30)), NOW)).toBe(false);
    });

    it("is not due before the delay elapses", () => {
      expect(messageIsDue(ctx(5, daysAgo(4)), NOW)).toBe(false);
    });

    it("is due exactly at the delay, and stays due after", () => {
      expect(messageIsDue(ctx(5, daysAgo(5)), NOW)).toBe(true);
      expect(messageIsDue(ctx(5, daysAgo(30)), NOW)).toBe(true);
    });
  });
});

describe("onboardingAdDue", () => {
  it("shows for a fresh workspace with no dismiss and few transactions", () => {
    expect(onboardingAdDue(null, 0)).toBe(true);
    expect(onboardingAdDue(null, 4)).toBe(true);
  });

  it("hides once dismissed, regardless of transaction count", () => {
    expect(onboardingAdDue(NOW, 0)).toBe(false);
  });

  it("hides at the 5th real transaction even without a dismiss", () => {
    expect(onboardingAdDue(null, 5)).toBe(false);
    expect(onboardingAdDue(null, 9)).toBe(false);
  });

  it("does not also expire on its own after elapsed time", () => {
    // Only a dismiss or the 5th transaction hides it — no third, time-based
    // condition, even for an old dismiss-less workspace with few transactions.
    expect(onboardingAdDue(null, 1)).toBe(true);
  });
});
