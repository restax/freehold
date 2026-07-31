import { describe, expect, it } from "vitest";
import {
  CLOUD_PROMPT_INTERVAL_DAYS,
  cloudPromptDue,
  cloudPromptText,
  DEFAULT_CLOUD_PROMPT,
} from "./cloud-prompt";

const NOW = new Date("2026-08-01T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("cloudPromptDue", () => {
  it("is due on a workspace that has never answered", () => {
    expect(cloudPromptDue({}, NOW)).toBe(true);
  });

  it("is never due once switched off", () => {
    expect(cloudPromptDue({ off: true }, NOW)).toBe(false);
    // Off wins even with an ancient snooze that would otherwise be due again.
    expect(cloudPromptDue({ off: true, snoozedAt: daysAgo(365) }, NOW)).toBe(false);
  });

  it("stays quiet for a month after a snooze", () => {
    expect(cloudPromptDue({ snoozedAt: daysAgo(1) }, NOW)).toBe(false);
    expect(cloudPromptDue({ snoozedAt: daysAgo(CLOUD_PROMPT_INTERVAL_DAYS - 1) }, NOW)).toBe(false);
  });

  it("comes back once the month is up", () => {
    expect(cloudPromptDue({ snoozedAt: daysAgo(CLOUD_PROMPT_INTERVAL_DAYS) }, NOW)).toBe(true);
    expect(cloudPromptDue({ snoozedAt: daysAgo(90) }, NOW)).toBe(true);
  });

  it("treats an unreadable snooze as no snooze, rather than silence forever", () => {
    expect(cloudPromptDue({ snoozedAt: "not a date" }, NOW)).toBe(true);
  });

  it("treats a future snooze as due — a bad clock shouldn't mute it for years", () => {
    expect(cloudPromptDue({ snoozedAt: daysAgo(-400) }, NOW)).toBe(false);
  });
});

describe("cloudPromptText", () => {
  it("falls back to the bundled copy when no operator has set any", () => {
    expect(cloudPromptText(null)).toBe(DEFAULT_CLOUD_PROMPT);
    expect(cloudPromptText(undefined)).toBe(DEFAULT_CLOUD_PROMPT);
  });

  it("uses the operator's copy when there is one", () => {
    expect(cloudPromptText("Come to Cloud.")).toBe("Come to Cloud.");
  });

  it("treats blank as 'use the default', not as off", () => {
    expect(cloudPromptText("")).toBe(DEFAULT_CLOUD_PROMPT);
    expect(cloudPromptText("   ")).toBe(DEFAULT_CLOUD_PROMPT);
  });

  it("returns nothing at all once the operator disables it install-wide", () => {
    expect(cloudPromptText("Come to Cloud.", false)).toBeNull();
    expect(cloudPromptText(null, false)).toBeNull();
  });
});
