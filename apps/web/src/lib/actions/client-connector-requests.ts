"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { REQUEST_NOTE_MAX } from "@/lib/client-connector";
import { str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * The coordinator's side of "changes need your approval".
 *
 * An unreviewed request is not work, which is why it lives in its own table
 * rather than as a task with a flag — a task row defaults to visible in both
 * portals, so an ask would echo straight back to the agent who made it
 * looking already scheduled. Approving is the moment it becomes work.
 *
 * Everything is re-derived here. The request names a transaction, but it was
 * written by an outside party's assistant and may have sat for days, so the
 * file is re-checked against the client at approve time — a file can change
 * hands in between, and approving must never move a task onto one that is no
 * longer theirs.
 */

async function loadPending(tenantId: string, requestId: string) {
  return withTenant(tenantId, (tx) =>
    tx.clientConnectorRequest.findFirst({
      // Status in the where-clause, not checked afterwards: two coordinators
      // clicking Approve at the same moment must not both create a task.
      where: { id: requestId, tenantId, status: "NEW" },
      select: {
        id: true,
        kind: true,
        payload: true,
        transactionId: true,
        clientId: true,
        client: { select: { name: true } },
      },
    }),
  );
}

/** The ask, as stored. Rendered as plain text everywhere — never as markup. */
function askOf(payload: unknown): { title: string; note: string | null } {
  const p = (payload ?? {}) as { title?: unknown; note?: unknown };
  return {
    title: typeof p.title === "string" ? p.title : "(untitled)",
    note: typeof p.note === "string" && p.note.length > 0 ? p.note : null,
  };
}

export async function approveClientConnectorRequest(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const requestId = str(formData, "requestId");
  if (!requestId) return;
  const note = str(formData, "note").slice(0, REQUEST_NOTE_MAX) || null;

  const request = await loadPending(tenantId, requestId);
  if (!request) return;
  const ask = askOf(request.payload);

  let createdTaskId: string | null = null;

  await withTenant(tenantId, async (tx) => {
    if (request.kind === "TASK" && request.transactionId) {
      // Re-verified, as the column's own comment promises: the file must
      // still belong to the client who asked about it.
      const txn = await tx.transaction.findFirst({
        where: { id: request.transactionId, tenantId, clientId: request.clientId },
        select: { id: true },
      });
      if (txn) {
        const task = await tx.task.create({
          data: {
            tenantId,
            transactionId: txn.id,
            title: ask.title,
            notes: ask.note,
            source: "client_connector",
            visibleToAgent: true,
          },
          select: { id: true },
        });
        createdTaskId = task.id;
      }
    }

    await tx.clientConnectorRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        resolutionNote: note,
        reviewedAt: new Date(),
        reviewedById: session.user.id,
        createdTaskId,
      },
    });
  });

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "client_connector.request_approved",
    summary: `Approved ${request.client.name}'s request: ${ask.title}`,
    subjectType: "clientConnectorRequest",
    subjectId: request.id,
  });
  revalidatePath(`/dashboard/clients/${request.clientId}`);
}

export async function declineClientConnectorRequest(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const requestId = str(formData, "requestId");
  if (!requestId) return;
  // The note is the point of declining rather than deleting: "already
  // scheduled for Tuesday" closes the loop instead of becoming a phone call.
  const note = str(formData, "note").slice(0, REQUEST_NOTE_MAX) || null;

  const request = await loadPending(tenantId, requestId);
  if (!request) return;
  const ask = askOf(request.payload);

  await withTenant(tenantId, (tx) =>
    tx.clientConnectorRequest.update({
      where: { id: request.id },
      data: {
        status: "DECLINED",
        resolutionNote: note,
        reviewedAt: new Date(),
        reviewedById: session.user.id,
      },
    }),
  );

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "client_connector.request_declined",
    summary: `Declined ${request.client.name}'s request: ${ask.title}`,
    subjectType: "clientConnectorRequest",
    subjectId: request.id,
  });
  revalidatePath(`/dashboard/clients/${request.clientId}`);
}
