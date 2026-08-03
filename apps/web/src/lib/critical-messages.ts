/**
 * Pure decision logic for the critical-messages broadcast system and the
 * onboarding ad widget — no Prisma, no React, so the actual "is this due"
 * questions can be unit-tested directly with an injected clock, the same
 * split as cloud-prompt.ts's cloudPromptDue and reviews.ts's reviewDue.
 *
 * The side-effecting half (batching the queries this needs, and the lazy
 * MessageShownAt write) lives in critical-messages-data.ts.
 */

import type { CriticalMessageTrigger } from "@freehold/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MessageDueContext {
  trigger: CriticalMessageTrigger;
  triggerDelayDays: number | null;
  /** Organization.hasSampleData for this workspace. */
  hasSampleData: boolean;
  /** Count of this workspace's Transaction rows where isSample is false. */
  realTransactionCount: number;
  /**
   * MessageShownAt.firstShownAt for triggerAfterMessageId, in this
   * workspace — null if that message has never been shown here (including
   * when triggerAfterMessageId itself is unset).
   */
  afterMessageFirstShownAt: Date | null;
}

/** Whether a CriticalMessage is currently due for a workspace. */
export function messageIsDue(ctx: MessageDueContext, now: Date = new Date()): boolean {
  switch (ctx.trigger) {
    case "IMMEDIATE":
      return true;
    case "HAS_SAMPLE_DATA":
      return ctx.hasSampleData;
    case "FIFTH_REAL_TRANSACTION":
      return ctx.realTransactionCount >= 5;
    case "DAYS_AFTER_MESSAGE": {
      if (!ctx.afterMessageFirstShownAt || ctx.triggerDelayDays == null) return false;
      const due = ctx.afterMessageFirstShownAt.getTime() + ctx.triggerDelayDays * DAY_MS;
      return due <= now.getTime();
    }
    default: {
      const _exhaustive: never = ctx.trigger;
      return _exhaustive;
    }
  }
}

/**
 * Whether the "30 day onboarding" ad widget should still show. Only two
 * hide conditions by design: a dismiss, or the workspace clearly under way
 * (its 5th real transaction). It does not also expire after some number of
 * elapsed days on its own.
 */
export function onboardingAdDue(dismissedAt: Date | null, realTransactionCount: number): boolean {
  if (dismissedAt) return false;
  return realTransactionCount < 5;
}
