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
