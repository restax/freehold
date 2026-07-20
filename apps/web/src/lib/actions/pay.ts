"use server";

import { PaymentRequestStatus, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { optStr, str } from "@/lib/forms";
import { fmtCents, parseFeeCents, totalCents } from "@/lib/pay";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

/**
 * Per-transaction user pay: admins set the fee, the user requests payment for
 * the fees that are due, an admin marks the request paid. No money moves
 * through Freehold — this is the record and the statement.
 */

/** Admin: what this user is paid for this file. Blank clears it. */
export async function setAssigneeFee(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id) return;
  const raw = str(formData, "feeCents");
  const feeCents = raw === "" ? null : parseFeeCents(raw);
  if (raw !== "" && feeCents === null) return; // unparseable — leave it alone

  const updated = await withTenant(tenantId, async (tx) => {
    // A fee already submitted for payment is part of a statement; changing it
    // would rewrite history, so it's locked once requested.
    const existing = await tx.paymentRequestItem.findUnique({
      where: { assigneeId: id },
      select: { id: true },
    });
    if (existing) return null;
    return tx.transactionAssignee.update({
      where: { id },
      data: { feeCents },
      select: {
        user: { select: { name: true } },
        transaction: { select: { propertyAddress: true } },
      },
    });
  });
  if (!updated) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "pay.fee_set",
    summary:
      feeCents === null
        ? `Cleared ${updated.user.name}'s fee on ${updated.transaction.propertyAddress}`
        : `Set ${updated.user.name}'s fee on ${updated.transaction.propertyAddress} to ${fmtCents(feeCents)}`,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/profile");
}

/**
 * The signed-in user submits their unbilled fees for payment. Whether a fee is
 * due at order time or at closing is the tenant's policy, so this never gates
 * on transaction status — the user decides when to ask.
 */
export async function requestPayment(formData: FormData) {
  const { tenantId, userId, session } = await requireTenant();
  const assigneeIds = formData.getAll("assigneeIds").map(String).filter(Boolean);
  if (assigneeIds.length === 0) return;

  const created = await withTenant(tenantId, async (tx) => {
    // Only this user's own assignments, only ones with a fee, and only ones
    // never billed before (the unique assignee_id also enforces this).
    const rows = await tx.transactionAssignee.findMany({
      where: {
        id: { in: assigneeIds },
        userId,
        feeCents: { not: null },
        paymentItem: { is: null },
      },
      select: {
        id: true,
        feeCents: true,
        transactionId: true,
        transaction: { select: { propertyAddress: true } },
      },
    });
    if (rows.length === 0) return null;

    return tx.paymentRequest.create({
      data: {
        tenantId,
        userId,
        note: optStr(formData, "note"),
        items: {
          create: rows.map((r) => ({
            tenantId,
            assigneeId: r.id,
            transactionId: r.transactionId,
            address: r.transaction.propertyAddress,
            feeCents: r.feeCents ?? 0,
          })),
        },
      },
      select: { id: true, items: { select: { feeCents: true, address: true } } },
    });
  });
  if (!created) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "pay.requested",
    summary: `Requested payment for ${created.items.length} transaction${
      created.items.length === 1 ? "" : "s"
    } — ${fmtCents(totalCents(created.items))}`,
  });
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/invoices");
}

/** Admin: record that a request has been paid, however it was settled. */
export async function markPaymentRequestPaid(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  if (!id) return;

  const paid = await withTenant(tenantId, async (tx) => {
    const req = await tx.paymentRequest.findUnique({
      where: { id },
      select: {
        status: true,
        user: { select: { name: true } },
        items: { select: { feeCents: true } },
      },
    });
    if (!req || req.status === PaymentRequestStatus.PAID) return null;
    await tx.paymentRequest.update({
      where: { id },
      data: {
        status: PaymentRequestStatus.PAID,
        paidAt: new Date(),
        paidById: session.user.id,
        paidNote: optStr(formData, "paidNote"),
      },
    });
    return req;
  });
  if (!paid) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "pay.marked_paid",
    summary: `Marked ${paid.user.name}'s ${fmtCents(totalCents(paid.items))} payment request paid`,
  });
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/profile");
}

/** The requester withdraws a request that hasn't been paid yet. */
export async function withdrawPaymentRequest(formData: FormData) {
  const { tenantId, userId, session } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;

  const removed = await withTenant(tenantId, async (tx) => {
    const req = await tx.paymentRequest.findUnique({
      where: { id },
      select: { userId: true, status: true, items: { select: { feeCents: true } } },
    });
    // Own requests only, and never one already settled.
    if (!req || req.userId !== userId || req.status === PaymentRequestStatus.PAID) return null;
    // Items cascade, which frees those assignments to be requested again.
    await tx.paymentRequest.delete({ where: { id } });
    return req;
  });
  if (!removed) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "pay.withdrawn",
    summary: `Withdrew a ${fmtCents(totalCents(removed.items))} payment request`,
  });
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/invoices");
}
