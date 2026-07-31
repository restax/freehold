/**
 * The Freehold Cloud prompt on self-hosted installs.
 *
 * Freehold is source-available and running your own copy is a supported,
 * first-class choice — so this is a monthly note in one place, not a wall
 * that follows you around. Cloud installs never see it (see isCloud), a
 * workspace can snooze it or switch it off for good, and an operator can
 * rewrite the copy or blank it out for the whole install.
 */

/**
 * Ships in the repo so an install that has never had an operator still has
 * something to say — the same arrangement as the Handbook's house style and
 * the TC licensing rule. Overridden by PlatformSetting.cloudPromptText.
 */
export const DEFAULT_CLOUD_PROMPT =
  "You're self-hosting Freehold, which means you own your data and your uptime. " +
  "Freehold Cloud runs it for you instead: automatic updates, managed backups, " +
  "and the AI features included — no keys to bring, no upgrades to schedule.";

/** Shape stored in Organization.cloudPromptConfig. */
export interface CloudPromptConfig {
  /** "Never show this again." Only an admin sets it, and it's reversible. */
  off?: boolean;
  /** ISO timestamp of the last "not now". The prompt returns a month later. */
  snoozedAt?: string;
}

export function readCloudPromptConfig(raw: unknown): CloudPromptConfig {
  return (raw ?? {}) as CloudPromptConfig;
}

/** A month, in the only sense a reminder needs to mean it. */
export const CLOUD_PROMPT_INTERVAL_DAYS = 30;

/**
 * Whether the prompt is due for this workspace.
 *
 * Two different noes, kept apart on purpose: "not now" snoozes for a month
 * and comes back, "never" is off and stays off. An unparseable or future
 * snooze timestamp counts as no snooze at all rather than silencing the
 * prompt forever on a bad clock or a hand-edited row.
 */
export function cloudPromptDue(cfg: CloudPromptConfig, now: Date = new Date()): boolean {
  if (cfg.off === true) return false;
  if (!cfg.snoozedAt) return true;
  const snoozed = Date.parse(cfg.snoozedAt);
  if (!Number.isFinite(snoozed)) return true;
  const elapsedDays = (now.getTime() - snoozed) / 86_400_000;
  return elapsedDays >= CLOUD_PROMPT_INTERVAL_DAYS;
}

/**
 * The copy to show, or null when the operator has switched the prompt off
 * for this whole install. Blank text falls back to the bundled default —
 * removing the prompt is the `enabled` flag's job, so an empty textarea can
 * never silently mean two different things.
 */
export function cloudPromptText(
  override: string | null | undefined,
  enabled = true,
): string | null {
  if (!enabled) return null;
  return override?.trim() || DEFAULT_CLOUD_PROMPT;
}
