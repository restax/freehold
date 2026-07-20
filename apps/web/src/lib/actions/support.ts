"use server";

import { prisma, TicketStatus, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { str } from "@/lib/forms";
import { adminAlert } from "@/lib/notify";
import { isOperator } from "@/lib/operator";
import { getSession } from "@/lib/session";
import { requireTenant } from "@/lib/tenant";

/**
 * Trouble tickets: filed from the sidebar widget on every dashboard page (one
 * textarea — "just type an issue and send"), with the page it was opened from
 * carried along automatically. A ticket is a thread: the tenant's own
 * replies and the operator's live in the same list, ordered by time.
 */

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

  logAudit({
    tenantId,
    actorId: userId,
    actorEmail: session.user.email,
    action: "ticket.created",
    summary: `Filed a support ticket: ${ticket.subject}`,
    subjectType: "SupportTicket",
    subjectId: ticket.id,
  });
  adminAlert(
    `🎫 New ticket from ${session.user.email} (${org?.name ?? tenantId})${
      pagePath ? ` on ${pagePath}` : ""
    }\n> ${body.slice(0, 400)}`,
  );

  revalidatePath("/dashboard/support");
  if (pagePath) revalidatePath(pagePath);
}

/** The tenant continuing their own ticket's thread. */
export async function addTicketReply(formData: FormData) {
  const { tenantId, session } = await requireTenant({ allowGuest: true });
  const ticketId = str(formData, "ticketId");
  const body = str(formData, "body");
  if (!ticketId || !body) return;

  await withTenant(tenantId, async (tx) => {
    const ticket = await tx.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return;
    await tx.supportTicketReply.create({
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
  });

  adminAlert(`🎫 Reply on a ticket from ${session.user.email}\n> ${body.slice(0, 400)}`);
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

  await withTenant(tenantId, async (tx) => {
    await tx.supportTicketReply.create({
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
  });

  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${ticketId}`);
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
