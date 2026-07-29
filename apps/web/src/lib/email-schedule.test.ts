import { describe, expect, it } from "vitest";
import { RESEND_SCHEDULE_MAX_MS, scheduleFitsResend } from "./email-schedule";

describe("scheduleFitsResend", () => {
  const now = new Date("2026-07-29T12:00:00Z");
  const at = (ms: number) => new Date(now.getTime() + ms);

  it("takes a send comfortably inside the window", () => {
    expect(scheduleFitsResend(at(15 * 60 * 1000), now)).toBe(true);
    expect(scheduleFitsResend(at(7 * 24 * 60 * 60 * 1000), now)).toBe(true);
  });

  it("takes a send only seconds out", () => {
    // The difference from scheduleFitsNylas, which refuses anything under two
    // minutes. Resend has no floor, so a "send later" set a few minutes ahead
    // — the common case when someone is timing a message — is still held by
    // the provider instead of falling through to the once-daily flush.
    expect(scheduleFitsResend(at(30 * 1000), now)).toBe(true);
    expect(scheduleFitsResend(at(1000), now)).toBe(true);
  });

  it("refuses a send past thirty days", () => {
    // Past this Resend rejects the send outright, so these have to fall back
    // to our own outbox rather than being handed over and silently dropped.
    expect(scheduleFitsResend(at(RESEND_SCHEDULE_MAX_MS + 1000), now)).toBe(false);
    expect(scheduleFitsResend(at(60 * 24 * 60 * 60 * 1000), now)).toBe(false);
  });

  it("accepts exactly on the ceiling", () => {
    expect(scheduleFitsResend(at(RESEND_SCHEDULE_MAX_MS), now)).toBe(true);
  });

  it("refuses now and anything already past", () => {
    // Equal timestamps are a send, not a schedule — and a scheduled_at in the
    // past is a rejected request at Resend, not an instant send, so the
    // caller must not treat this as a schedule it can hand over.
    expect(scheduleFitsResend(at(0), now)).toBe(false);
    expect(scheduleFitsResend(at(-60 * 1000), now)).toBe(false);
  });

  it("defaults to the current clock when no now is given", () => {
    expect(scheduleFitsResend(new Date(Date.now() + 60 * 60 * 1000))).toBe(true);
    expect(scheduleFitsResend(new Date(Date.now() - 60 * 60 * 1000))).toBe(false);
  });
});
