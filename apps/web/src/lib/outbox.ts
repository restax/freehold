import { prisma } from "@freehold/db";
import { sendTenantEmail } from "@/lib/email";
import { cancelNylasSchedule, nylasEnabled, scheduleFitsNylas, sendViaNylas } from "@/lib/nylas";

/**
 * The outbox: scheduled and quiet-hours-deferred email. Automated sends route
 * through enqueueOrSend so a 2am task completion becomes an 8am email.
 *
 * **Rows here are only as punctual as whatever drains them.** There is an
 * /api/outbox/run endpoint, but it is *not* registered in vercel.json — the
 * only thing calling flushOutbox in production is the nightly cron, so a row
 * parked here can wait until the next daily run. Anything that has to arrive
 * at the time the coordinator picked should go through scheduleEmail below,
 * which hands the schedule to Nylas when it can.
 */

export interface QuietHours {
  /** Hour 0-23 when sending pauses (workspace time). */
  quietStart: number;
  /** Hour 0-23 when sending resumes. */
  quietEnd: number;
  timeZone: string;
}

export const DEFAULT_QUIET_HOURS: QuietHours = {
  quietStart: 20,
  quietEnd: 8,
  timeZone: "America/Chicago",
};

export function parseQuietHours(raw: unknown): QuietHours {
  const c = (raw ?? {}) as { quietStart?: number; quietEnd?: number; timeZone?: string };
  const hour = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
  };
  let timeZone = DEFAULT_QUIET_HOURS.timeZone;
  if (typeof c.timeZone === "string" && c.timeZone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: c.timeZone });
      timeZone = c.timeZone;
    } catch {
      // invalid zone → default
    }
  }
  return {
    quietStart: hour(c.quietStart, DEFAULT_QUIET_HOURS.quietStart),
    quietEnd: hour(c.quietEnd, DEFAULT_QUIET_HOURS.quietEnd),
    timeZone,
  };
}

function hourInZone(date: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(date),
  );
}

export function isQuietTime(now: Date, q: QuietHours): boolean {
  const h = hourInZone(now, q.timeZone);
  if (q.quietStart === q.quietEnd) return false; // no quiet window
  // Window may wrap midnight (20 → 8) or not (0 → 6).
  return q.quietStart > q.quietEnd
    ? h >= q.quietStart || h < q.quietEnd
    : h >= q.quietStart && h < q.quietEnd;
}

/** The next moment sending is allowed (start of quietEnd hour). */
export function nextSendTime(now: Date, q: QuietHours): Date {
  if (!isQuietTime(now, q)) return now;
  // Walk forward hour by hour until outside the window (max 24 steps).
  const t = new Date(now.getTime());
  t.setMinutes(0, 0, 0);
  for (let i = 0; i < 25; i++) {
    t.setHours(t.getHours() + 1);
    if (!isQuietTime(t, q)) return t;
  }
  return now;
}

export interface OutboxInput {
  tenantId: string;
  transactionId?: string | null;
  to: string;
  subject: string;
  body: string;
  /** Explicit schedule; otherwise now (possibly deferred by quiet hours). */
  sendAt?: Date;
  respectQuietHours?: boolean;
}

/** Send immediately when allowed; otherwise queue for the cron. */
export async function enqueueOrSend(input: OutboxInput): Promise<"sent" | "queued"> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.tenantId },
    select: { emailSettings: true },
  });
  const quiet = parseQuietHours(org.emailSettings);
  const now = new Date();
  let sendAt = input.sendAt ?? now;
  if (input.respectQuietHours !== false && sendAt <= now) {
    sendAt = nextSendTime(now, quiet);
  }
  if (sendAt <= now) {
    await sendTenantEmail({
      tenantId: input.tenantId,
      transactionId: input.transactionId,
      to: input.to,
      subject: input.subject,
      body: input.body,
    });
    return "sent";
  }
  await prisma.emailOutbox.create({
    data: {
      tenantId: input.tenantId,
      transactionId: input.transactionId ?? null,
      toAddr: input.to,
      subject: input.subject,
      body: input.body,
      sendAt,
    },
  });
  return "queued";
}

export interface ScheduleInput {
  tenantId: string;
  transactionId?: string | null;
  to: string;
  subject: string;
  body: string;
  html?: string;
  sendAt: Date;
  /** Send from this user's own mailbox, if they've connected one. */
  sendAsUserId?: string | null;
  attachments?: Array<{ filename: string; content: string }>;
}

/**
 * Hold a message for a set time, preferring whoever can hit that time.
 *
 * When it's going out from the coordinator's own mailbox, Nylas holds it and
 * delivers on the minute. Our own outbox can only be as punctual as the cron
 * that drains it, so a message parked there arrives on the next run rather
 * than at the time the coordinator picked. Nylas only accepts a window of two
 * minutes to thirty days, so anything outside that still falls back to us.
 */
export async function scheduleEmail(input: ScheduleInput): Promise<"nylas" | "outbox"> {
  const grant =
    input.sendAsUserId && nylasEnabled()
      ? await prisma.nylasGrant.findUnique({
          where: { userId: input.sendAsUserId },
          select: { grantId: true, status: true },
        })
      : null;

  if (grant?.status === "valid" && scheduleFitsNylas(input.sendAt)) {
    const sent = await sendViaNylas({
      grantId: grant.grantId,
      to: [input.to],
      subject: input.subject,
      body: input.html ?? input.body,
      attachments: input.attachments,
      sendAt: input.sendAt,
    });
    // Recorded even though Nylas owns the delivery, so it shows up in the
    // coordinator's scheduled list and stays cancellable. The flush skips
    // rows carrying a schedule id.
    await prisma.emailOutbox.create({
      data: {
        tenantId: input.tenantId,
        transactionId: input.transactionId ?? null,
        toAddr: input.to,
        subject: input.subject,
        body: input.body,
        sendAt: input.sendAt,
        sendAsUserId: input.sendAsUserId ?? null,
        nylasScheduleId: sent.scheduleId,
        nylasGrantId: grant.grantId,
      },
    });
    return "nylas";
  }

  await prisma.emailOutbox.create({
    data: {
      tenantId: input.tenantId,
      transactionId: input.transactionId ?? null,
      toAddr: input.to,
      subject: input.subject,
      body: input.body,
      sendAt: input.sendAt,
      sendAsUserId: input.sendAsUserId ?? null,
    },
  });
  return "outbox";
}

/**
 * Call off a scheduled send.
 *
 * Returns false when the message is already gone — Nylas needs ten seconds'
 * notice, so a cancel can lose the race. Saying so is the point: the row
 * stays uncancelled and the coordinator learns it went out, rather than
 * seeing "cancelled" for mail that is already in someone's inbox.
 */
export async function cancelScheduled(id: string, tenantId: string): Promise<boolean> {
  const row = await prisma.emailOutbox.findFirst({
    where: { id, tenantId, sentAt: null, canceledAt: null },
    select: { nylasScheduleId: true, nylasGrantId: true },
  });
  if (!row) return false;

  if (row.nylasScheduleId && row.nylasGrantId) {
    const ok = await cancelNylasSchedule(row.nylasGrantId, row.nylasScheduleId).catch(() => false);
    if (!ok) return false;
  }
  await prisma.emailOutbox.updateMany({
    where: { id, tenantId, sentAt: null },
    data: { canceledAt: new Date() },
  });
  return true;
}

/** Cron entry: deliver everything due. Failures retry up to 5 runs. */
export async function flushOutbox(): Promise<{ sent: number; failed: number }> {
  const due = await prisma.emailOutbox.findMany({
    where: {
      sentAt: null,
      canceledAt: null,
      sendAt: { lte: new Date() },
      attempts: { lt: 5 },
      // Nylas is delivering these itself; sending them here too would put
      // the same message in the recipient's inbox twice.
      nylasScheduleId: null,
    },
    orderBy: { sendAt: "asc" },
    take: 50,
  });
  let sent = 0;
  let failed = 0;
  for (const row of due) {
    try {
      // Branded HTML is rendered at send time so signatures/footers and
      // party details are current, not frozen at scheduling time.
      let html: string | undefined;
      if (row.transactionId) {
        const { emailContextForTransaction } = await import("@/lib/auto-emails");
        const { parseEmailSettings, renderEmailHtml } = await import("@/lib/email-template");
        const ctx = await emailContextForTransaction(row.tenantId, row.transactionId, {}).catch(
          () => null,
        );
        if (ctx) {
          html = renderEmailHtml({
            tenantName: ctx.org.name,
            body: row.body,
            tc: ctx.tcCard,
            agent: ctx.agentCard,
            otherSide: ctx.otherCard,
            ...parseEmailSettings(ctx.org.emailSettings),
          });
        }
      }
      await sendTenantEmail({
        tenantId: row.tenantId,
        transactionId: row.transactionId,
        to: row.toAddr,
        subject: row.subject,
        body: row.body,
        html,
        sendAsUserId: row.sendAsUserId,
      });
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: { sentAt: new Date() },
      });
      sent++;
    } catch (err) {
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 }, lastError: String(err).slice(0, 500) },
      });
      failed++;
    }
  }
  return { sent, failed };
}
