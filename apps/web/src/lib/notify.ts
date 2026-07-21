import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Operator alerts to Slack. Two interchangeable credentials, first match
 * wins; with neither set — the default on self-hosted installs — this is a
 * no-op. Always fire-and-forget: alerts never block or fail a request.
 *
 * - SLACK_ADMIN_WEBHOOK_URL: an Incoming Webhook (already tied to a channel).
 * - SLACK_BOT_TOKEN + SLACK_ADMIN_CHANNEL: a bot token with chat:write; the
 *   bot must be invited to the channel.
 */
export function adminAlert(text: string): void {
  const webhook = process.env.SLACK_ADMIN_WEBHOOK_URL;
  if (webhook) {
    fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => {});
    return;
  }

  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_ADMIN_CHANNEL;
  if (token && channel) {
    fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, text }),
    }).catch(() => {});
  }
}

interface SlackPostResult {
  channel: string;
  ts: string;
}

/**
 * Post a support-ticket alert as the bot, not the incoming webhook — a
 * webhook's response carries no message id, so there's nothing to thread
 * replies against. This is the half of two-way Slack support that makes a
 * ticket threadable; the inbound webhook (api/webhooks/slack) is the other
 * half. Returns null when the bot isn't configured (webhook-only installs
 * keep getting the one-way adminAlert ping) or the call fails — callers fall
 * back to adminAlert either way, so alerts never silently stop.
 */
export async function postTicketAlert(text: string): Promise<SlackPostResult | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_ADMIN_CHANNEL;
  if (!token || !channel) return null;
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, text }),
    });
    const json = (await res.json()) as { ok?: boolean; channel?: string; ts?: string };
    if (!json.ok || !json.channel || !json.ts) return null;
    return { channel: json.channel, ts: json.ts };
  } catch {
    return null;
  }
}

/**
 * Post into an already-open Slack thread — the app-side half of ticket sync,
 * so an in-app reply (from either the tenant or an operator) shows up in the
 * same Slack thread the other direction reads from. Fire-and-forget, same as
 * adminAlert; a delivery failure here must never fail the reply itself.
 */
export function postToSlackThread(channel: string, threadTs: string, text: string): void {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;
  fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, thread_ts: threadTs, text }),
  }).catch(() => {});
}

/**
 * Slack's standard v0 request signature: HMAC-SHA256 of
 * `v0:{timestamp}:{rawBody}` with the signing secret, hex-encoded and
 * prefixed `v0=`. Requests older than 5 minutes are rejected as a replay
 * guard, matching Slack's own recommendation — mirrors verifyResendWebhook's
 * shape in lib/email.ts for the same reason (a different provider, the same
 * "raw body + timestamped HMAC, timing-safe compare" discipline).
 */
export function verifySlackSignature(
  rawBody: string,
  headers: { timestamp: string | null; signature: string | null },
): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !headers.timestamp || !headers.signature) return false;
  const tsSeconds = Number(headers.timestamp);
  if (!Number.isFinite(tsSeconds) || Math.abs(Date.now() / 1000 - tsSeconds) > 300) return false;
  const expected = `v0=${createHmac("sha256", secret)
    .update(`v0:${headers.timestamp}:${rawBody}`)
    .digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(headers.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
