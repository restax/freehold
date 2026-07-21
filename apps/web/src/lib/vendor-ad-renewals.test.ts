import { describe, expect, it } from "vitest";
import { DRIP_INTERVAL_DAYS, renewalDue, TRIAL_DAYS, trialEndFrom } from "./vendor-ad-renewals";

const DAY_MS = 24 * 3600 * 1000;

describe("trialEndFrom", () => {
  it("adds the trial length to the start date", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = trialEndFrom(start);
    expect(end.getTime() - start.getTime()).toBe(TRIAL_DAYS * DAY_MS);
  });
});

describe("renewalDue", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("is due when nothing has been sent yet", () => {
    expect(renewalDue(null, now)).toBe(true);
  });

  it("is not due before the interval elapses", () => {
    const lastSent = new Date(now.getTime() - (DRIP_INTERVAL_DAYS - 1) * DAY_MS);
    expect(renewalDue(lastSent, now)).toBe(false);
  });

  it("is due exactly at the interval", () => {
    const lastSent = new Date(now.getTime() - DRIP_INTERVAL_DAYS * DAY_MS);
    expect(renewalDue(lastSent, now)).toBe(true);
  });

  it("is due well past the interval", () => {
    const lastSent = new Date(now.getTime() - 30 * DAY_MS);
    expect(renewalDue(lastSent, now)).toBe(true);
  });
});
