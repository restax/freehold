import { prisma, withTenant } from "@freehold/db";
import { cancelResendEmail, emailEnabled, sendTenantEmail } from "@/lib/email";
import { scheduleFitsResend } from "@/lib/email-schedule";
import { cancelNylasSchedule, nylasEnabled, scheduleFitsNylas, sendViaNylas } from "@/lib/nylas";

/**
 * The outbox: scheduled and quiet-hours-deferred email. Automated sends route
 * through enqueueOrSend so a 2am task completion becomes an 8am email.
 *
 * **Rows here are only as punctual as whatever drains them**, and what drains
 * them is the nightly cron. /api/outbox/run exists but is not registered in
 * vercel.json, and can't be: Vercel's Hobby plan allows a project two cron
 * jobs on daily schedules only, and both slots are spoken for. A row parked
 * here waits for the next nightly run — up to the best part of a day.
 *
 * So a time the coordinator actually picked is never left to this table.
 * Both scheduleEmail and enqueueOrSend hand the schedule to a provider that
 * will hold it and release it on the minute — Nylas when the message is going
 * out from someone's own mailbox, Resend when it's going out from the
 * workspace address. The rows they leave behind are records for the UI (see
 * it, cancel it), and the flush skips them. What still lands in this table as
 * real work is only what neither provider would take: a schedule past thirty
 * days, or a send-as-self whose mailbox is currently unlinked.
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

/**
 * The branded wrapper for a transaction's outbox mail.
 *
 * Rendered against the workspace's current signature, footer and party
 * details rather than a copy frozen when the row was written. That used to
 * happen at flush time, which was as late as possible; now that a provider
 * holds the schedule, the latest we can still render is the moment the send
 * is handed over. Both callers go through here so neither drifts.
 */
async function renderOutboxHtml(
  tenantId: string,
  transactionId: string | null,
  body: string,
): Promise<string | undefined> {
  if (!transactionId) return undefined;
  const { emailContextForTransaction } = await import("@/lib/auto-emails");
  const { parseEmailSettings, renderEmailHtml } = await import("@/lib/email-template");
  const ctx = await emailContextForTransaction(tenantId, transactionId, {}).catch(() => null);
  if (!ctx) return undefined;
  return renderEmailHtml({
    tenantName: ctx.org.name,
    body,
    tc: ctx.tcCard,
    agent: ctx.agentCard,
    otherSide: ctx.otherCard,
    ...parseEmailSettings(ctx.org.emailSettings),
  });
}

/** Send immediately when allowed; otherwise schedule it for later. */
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
  // Deferred out of quiet hours. That end time is a real time — 8am means
  // 8am — so it goes through the same scheduling path as a coordinator's
  // explicit "send later" rather than being parked for the nightly cron,
  // which would turn an 8am email into whenever the cron next ran.
  await scheduleEmail({
    tenantId: input.tenantId,
    transactionId: input.transactionId,
    to: input.to,
    subject: input.subject,
    body: input.body,
    sendAt,
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
 * Neither provider is a nicety: our own outbox is only as punctual as the
 * nightly cron that drains it, so a message parked there arrives on the next
 * run rather than at the time the coordinator picked. Whoever is carrying the
 * message holds the schedule instead — Nylas for a coordinator's own mailbox,
 * Resend for the workspace address — and releases it on the minute.
 *
 * Both providers stop at thirty days, and Nylas also refuses anything under
 * two minutes. A schedule outside what the carrier will take falls back to
 * the outbox, and is the one case that still waits for the cron.
 */
export async function scheduleEmail(input: ScheduleInput): Promise<"nylas" | "resend" | "outbox"> {
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
    //
    // Known gap: a reply to *this* message won't thread onto the file. The
    // inbound webhook resolves a reply's transaction via NylasSend, keyed on
    // the real message/thread id — and a scheduled send doesn't have those
    // yet (sendViaNylas returns a schedule id in their place; the message
    // itself doesn't exist until Nylas releases it). Closing this needs the
    // message.send_success webhook, which fires once the send completes and
    // can supply the missing ids — not built yet. Nothing breaks either way:
    // an unmatched reply is silently ignored, same as any other mail in a
    // connected inbox that isn't about a Freehold transaction.
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

  // Resend holds it instead, from the workspace address.
  //
  // Gated on the grant being unusable rather than merely on Nylas having
  // declined the window: a coordinator with a working mailbox who scheduled
  // something forty days out asked to send as themselves, and quietly
  // rerouting that to the shared identity is not ours to decide. Those wait
  // for the cron, which still re-checks the grant when it drains them.
  if (grant?.status !== "valid" && emailEnabled() && scheduleFitsResend(input.sendAt)) {
    const html =
      input.html ??
      (await renderOutboxHtml(input.tenantId, input.transactionId ?? null, input.body));
    const sent = await sendTenantEmail({
      tenantId: input.tenantId,
      transactionId: input.transactionId,
      to: input.to,
      subject: input.subject,
      body: input.body,
      html,
      attachments: input.attachments,
      sendAt: input.sendAt,
    });
    // Recorded even though Resend owns the delivery, same as the Nylas branch
    // above: this is what puts the message in the coordinator's scheduled list
    // and keeps it cancellable. The flush skips rows carrying a message id.
    //
    // The fallback id covers a 200 that somehow carried no id. The message is
    // already booked at that point and can't be unbooked, so the row has to
    // exist and has to stay out of the flush; a cancel against it will fail at
    // Resend, which is the truthful answer — we have no handle on that send.
    await prisma.emailOutbox.create({
      data: {
        tenantId: input.tenantId,
        transactionId: input.transactionId ?? null,
        toAddr: input.to,
        subject: input.subject,
        body: input.body,
        sendAt: input.sendAt,
        resendEmailId: sent.providerId ?? "unknown",
      },
    });
    return "resend";
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
 * Returns false when the message is already gone — a provider holding the
 * schedule wants some notice before the send time (Nylas asks for ten
 * seconds), so a cancel can lose the race. Saying so is the point: the row
 * stays uncancelled and the coordinator learns it went out, rather than
 * seeing "cancelled" for mail that is already in someone's inbox.
 */
export async function cancelScheduled(id: string, tenantId: string): Promise<boolean> {
  const row = await prisma.emailOutbox.findFirst({
    where: { id, tenantId, sentAt: null, canceledAt: null },
    select: { nylasScheduleId: true, nylasGrantId: true, resendEmailId: true },
  });
  if (!row) return false;

  if (row.nylasScheduleId && row.nylasGrantId) {
    const ok = await cancelNylasSchedule(row.nylasGrantId, row.nylasScheduleId).catch(() => false);
    if (!ok) return false;
  } else if (row.resendEmailId) {
    const ok = await cancelResendEmail(row.resendEmailId).catch(() => false);
    if (!ok) return false;
    // The Email row was written when the send was booked, so it's sitting in
    // the thread as SCHEDULED for a message that will now never arrive.
    //
    // Through withTenant, not the bare client: `email` is RLS-protected, so an
    // unscoped updateMany matches nothing and reports a contented zero. That
    // silence is the whole hazard — the cancel looks like it worked while the
    // thread still shows the message as due to go out.
    await withTenant(tenantId, (tx) =>
      tx.email.updateMany({
        where: { providerId: row.resendEmailId as string, status: "SCHEDULED" },
        data: { status: "CANCELLED" },
      }),
    ).catch(() => {});
  }
  await prisma.emailOutbox.updateMany({
    where: { id, tenantId, sentAt: null },
    data: { canceledAt: new Date() },
  });
  return true;
}

/**
 * Cron entry: deliver everything due. Failures retry up to 5 runs.
 *
 * The residue, not the main path — what reaches here is a schedule no
 * provider would hold, so these are late by design rather than on time. See
 * the note at the top of this file.
 */
export async function flushOutbox(): Promise<{ sent: number; failed: number }> {
  const due = await prisma.emailOutbox.findMany({
    where: {
      sentAt: null,
      canceledAt: null,
      sendAt: { lte: new Date() },
      attempts: { lt: 5 },
      // A provider is delivering these itself; sending them here too would
      // put the same message in the recipient's inbox twice.
      nylasScheduleId: null,
      resendEmailId: null,
    },
    orderBy: { sendAt: "asc" },
    take: 50,
  });
  let sent = 0;
  let failed = 0;
  for (const row of due) {
    try {
      const html = await renderOutboxHtml(row.tenantId, row.transactionId, row.body);
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
