import { prisma, TicketStatus, withTenant } from "@freehold/db";
import { verifySlackSignature } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Inbound half of two-way Slack support. A reply typed in a ticket's Slack
 * thread arrives here as a `message` event; it's matched back to its ticket
 * via SlackTicketLink (channel + thread timestamp — the only identifiers a
 * Slack event carries, no tenant context), then becomes a real operator
 * reply, same as if it had been typed in /admin/tickets. The outbound half
 * (posting the ticket and every in-app reply into that thread) lives in
 * lib/actions/support.ts.
 *
 * Setup: create a Slack App with bot scopes chat:write, channels:history (or
 * groups:history for a private channel), and users:read; enable Event
 * Subscriptions with this route as the Request URL, subscribed to bot event
 * `message.channels` (or `message.groups`); invite the bot to the alert
 * channel. SLACK_BOT_TOKEN, SLACK_ADMIN_CHANNEL, and SLACK_SIGNING_SECRET all
 * come from that same app.
 */

interface SlackEvent {
  type?: string;
  subtype?: string;
  bot_id?: string;
  channel?: string;
  thread_ts?: string;
  ts?: string;
  text?: string;
  user?: string;
}

interface SlackEventPayload {
  type?: string;
  challenge?: string;
  event?: SlackEvent;
}

/** Best-effort: a real name beats a raw Slack user id, but never blocks the reply on it. */
async function resolveSlackDisplayName(userId: string): Promise<string> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return userId;
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as {
      ok?: boolean;
      user?: { real_name?: string; name?: string; profile?: { real_name?: string } };
    };
    if (!json.ok || !json.user) return userId;
    return json.user.profile?.real_name || json.user.real_name || json.user.name || userId;
  } catch {
    return userId;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const verified = verifySlackSignature(rawBody, {
    timestamp: req.headers.get("x-slack-request-timestamp"),
    signature: req.headers.get("x-slack-signature"),
  });
  if (!verified) return new Response("Invalid signature", { status: 400 });

  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(rawBody) as SlackEventPayload;
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  // The one-time handshake Slack does when the Request URL is first saved.
  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  if (payload.type === "event_callback") {
    const event = payload.event;
    // Only a plain new message in a thread: no subtype (edits/deletes/joins
    // all carry one) and no bot_id (our own alert and thread posts do) — the
    // second check is what keeps this from replying to its own echoes.
    if (
      event?.type === "message" &&
      !event.subtype &&
      !event.bot_id &&
      event.channel &&
      event.thread_ts &&
      event.text &&
      event.user
    ) {
      const link = await prisma.slackTicketLink.findUnique({
        where: {
          slackChannel_slackThreadTs: {
            slackChannel: event.channel,
            slackThreadTs: event.thread_ts,
          },
        },
      });
      // No match just means this is some other thread in the same channel —
      // not every message in the alert channel is a ticket reply.
      if (link) {
        const name = await resolveSlackDisplayName(event.user);
        await withTenant(link.tenantId, async (tx) => {
          await tx.supportTicketReply.create({
            data: {
              tenantId: link.tenantId,
              ticketId: link.ticketId,
              body: event.text as string,
              fromOperator: true,
              authorEmail: `${name} (Slack)`,
            },
          });
          await tx.supportTicket.update({
            where: { id: link.ticketId },
            data: { status: TicketStatus.ANSWERED },
          });
        });
      }
    }
  }

  return new Response("ok", { status: 200 });
}
