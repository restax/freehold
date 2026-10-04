"use server";

import { prisma, TicketStatus, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { str } from "@/lib/forms";
import { adminAlert, postTicketAlert, postToSlackThread } from "@/lib/notify";
import { isOperator } from "@/lib/operator";
import { getSession } from "@/lib/session";
import { putObject } from "@/lib/storage";
import { acceptSupportFiles } from "@/lib/support-attachments";
import { getMemberRole, requireTenant } from "@/lib/tenant";

/**
 * Trouble tickets: filed from the sidebar widget on every dashboard page (one
 * textarea — "just type an issue and send"), with the page it was opened from
 * carried along automatically. A ticket is a thread: the tenant's own
 * replies and the operator's live in the same list, ordered by time.
 *
 * When SLACK_BOT_TOKEN + SLACK_ADMIN_CHANNEL are configured, a new ticket is
 * posted as the bot (not the one-way incoming webhook) and its channel +
 * message timestamp are kept on SlackTicketLink — that's what lets a reply
 * typed right in the Slack thread come back in as a real ticket reply via the
 * inbound webhook at api/webhooks/slack. Every reply, from either side, also
 * gets echoed into that same thread so Slack and the app never diverge.
 * Without bot credentials this degrades to the original one-way adminAlert
 * ping — nothing breaks, it just isn't repliable from Slack.
 */

/** The Slack thread a ticket is linked to, if the bot posted it. No tenant
 *  context needed — this table has no RLS, same "resolve the capability
 *  first" shape as VendorOrderLink. */
async function slackLinkFor(ticketId: string) {
  return prisma.slackTicketLink.findUnique({
    where: { ticketId },
    select: { slackChannel: true, slackThreadTs: true },
  });
}

/**
 * Store the screenshots/PDFs that came with a ticket or reply and record them.
 * Returns how many were kept. Not exported: in a "use server" file every
 * export is a callable endpoint, and this takes a tenantId.
 */
async function saveAttachments(
  tenantId: string,
  ticketId: string,
  replyId: string | null,
  formData: FormData,
): Promise<number> {
  const { accepted } = await acceptSupportFiles(formData.getAll("files"));
  if (accepted.length === 0) return 0;
  const stored = await Promise.all(
    accepted.map((f) => putObject(tenantId, f.filename, f.bytes, f.contentType)),
  );
  await withTenant(tenantId, (tx) =>
    tx.supportAttachment.createMany({
      data: accepted.map((f, i) => ({
        tenantId,
        ticketId,
        replyId,
        filename: f.filename,
        contentType: f.contentType,
        sizeBytes: f.bytes.length,
        data: stored[i].data,
        storageKey: stored[i].storageKey,
        storageProvider: stored[i].storageProvider,
      })),
    }),
  );
  return accepted.length;
}

/** " 📎 2 attachments" for the Slack echo, or nothing. */
function attachedNote(count: number): string {
  return count > 0 ? ` 📎 ${count} attachment${count === 1 ? "" : "s"}` : "";
}

function deriveSubject(body: string): string {
  const flat = body.trim().replace(/\s+/g, " ");
  return flat.length > 60 ? `${flat.slice(0, 60)}…` : flat || "(no subject)";
}

export async function createTicket(formData: FormData) {
  const { tenantId, userId, session } = await requireTenant({ allowGuest: true });
  const body = str(formData, "body");
  if (!body) return;
  const pagePath = str(formData, "pagePath") || null;

  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });

  const ticket = await withTenant(tenantId, (tx) =>
    tx.supportTicket.create({
      data: { tenantId, userId, subject: deriveSubject(body), body, pagePath },
    }),
  );

  const attached = await saveAttachments(tenantId, ticket.id, null, formData);

  logAudit({
    tenantId,
    actorId: userId,
    actorEmail: session.user.email,
    action: "ticket.created",
    summary: `Filed a support ticket: ${ticket.subject}`,
    subjectType: "SupportTicket",
    subjectId: ticket.id,
  });

  const alertText = `🎫 New ticket from ${session.user.email} (${org?.name ?? tenantId})${
    pagePath ? ` on ${pagePath}` : ""
  }${attachedNote(attached)}\n> ${body.slice(0, 400)}`;
  const posted = await postTicketAlert(alertText);
  if (posted) {
    await prisma.slackTicketLink.create({
      data: {
        tenantId,
        ticketId: ticket.id,
        slackChannel: posted.channel,
        slackThreadTs: posted.ts,
      },
    });
  } else {
    // Bot not configured — the original one-way ping (webhook or none).
    adminAlert(alertText);
  }

  revalidatePath("/dashboard/support");
  if (pagePath) revalidatePath(pagePath);
}

/** The tenant continuing their own ticket's thread. */
export async function addTicketReply(formData: FormData) {
  const { tenantId, session } = await requireTenant({ allowGuest: true });
  const ticketId = str(formData, "ticketId");
  const body = str(formData, "body");
  if (!ticketId || !body) return;

  const replyId = await withTenant(tenantId, async (tx) => {
    const ticket = await tx.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return null;
    const reply = await tx.supportTicketReply.create({
      data: { tenantId, ticketId, body, fromOperator: false, authorEmail: session.user.email },
    });
    // A reply from the tenant re-opens a closed or already-answered ticket —
    // it means the conversation isn't done.
    if (ticket.status !== TicketStatus.OPEN) {
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.OPEN },
      });
    }
    return reply.id;
  });
  if (!replyId) return;
  const attached = await saveAttachments(tenantId, ticketId, replyId, formData);

  const link = await slackLinkFor(ticketId);
  if (link) {
    postToSlackThread(
      link.slackChannel,
      link.slackThreadTs,
      `💬 ${session.user.email} replied in the app:${attachedNote(attached)}\n> ${body.slice(0, 400)}`,
    );
  } else {
    adminAlert(
      `🎫 Reply on a ticket from ${session.user.email}${attachedNote(attached)}\n> ${body.slice(0, 400)}`,
    );
  }
  revalidatePath("/dashboard/support");
}

/** Operator reply — answers the ticket and marks it so. */
export async function adminReplyToTicket(formData: FormData) {
  if (!(await isOperator())) return;
  const tenantId = str(formData, "tenantId");
  const ticketId = str(formData, "ticketId");
  const body = str(formData, "body");
  if (!tenantId || !ticketId || !body) return;
  const session = await getSession();

  const replyId = await withTenant(tenantId, async (tx) => {
    const ticket = await tx.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return null;
    const reply = await tx.supportTicketReply.create({
      data: {
        tenantId,
        ticketId,
        body,
        fromOperator: true,
        authorEmail: session?.user.email ?? "support@freeholdtc.dev",
      },
    });
    await tx.supportTicket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.ANSWERED },
    });
    return reply.id;
  });
  if (!replyId) return;
  const attached = await saveAttachments(tenantId, ticketId, replyId, formData);

  // Mirror into the Slack thread so an operator answering from the admin
  // panel and one answering right in Slack both see the whole conversation.
  const link = await slackLinkFor(ticketId);
  if (link)
    postToSlackThread(link.slackChannel, link.slackThreadTs, `${body}${attachedNote(attached)}`);

  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${ticketId}`);
}

/**
 * The tenant side of closing a ticket — no reply required, for the case
 * where the answer already given was enough. Any member can close their own
 * ticket; an admin can close anyone's in the workspace, matching the same
 * split the ticket list itself already reads by (isAdmin ? all : own).
 * Reopening is the same action with the opposite value — a closed ticket
 * with new information in it should never dead-end back into the same
 * "type and send" widget with nowhere for the reply to land.
 */
export async function setTicketStatusSelf(formData: FormData) {
  const { tenantId, userId, session } = await requireTenant({ allowGuest: true });
  const ticketId = str(formData, "ticketId");
  const status = str(formData, "status");
  if (!ticketId || (status !== "OPEN" && status !== "CLOSED")) return;

  const role = await getMemberRole(tenantId, userId);
  const isAdmin = role === "owner" || role === "admin";

  await withTenant(tenantId, async (tx) => {
    const ticket = await tx.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket || (!isAdmin && ticket.userId !== userId)) return;
    await tx.supportTicket.update({
      where: { id: ticketId },
      data: { status: status as TicketStatus },
    });
  });

  const link = await slackLinkFor(ticketId);
  if (link && status === "CLOSED") {
    postToSlackThread(link.slackChannel, link.slackThreadTs, `✅ Closed by ${session.user.email}`);
  }

  revalidatePath("/dashboard/support");
}

/** Operator-only: close or reopen a ticket without adding a reply. */
export async function adminSetTicketStatus(formData: FormData) {
  if (!(await isOperator())) return;
  const tenantId = str(formData, "tenantId");
  const ticketId = str(formData, "ticketId");
  const status = str(formData, "status");
  if (!tenantId || !ticketId || !(status in TicketStatus)) return;

  await withTenant(tenantId, (tx) =>
    tx.supportTicket.update({ where: { id: ticketId }, data: { status: status as TicketStatus } }),
  );

  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${ticketId}`);
}
