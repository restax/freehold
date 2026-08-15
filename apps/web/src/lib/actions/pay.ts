"use server";

import { PaymentRequestStatus, type TenantTx, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { type AttributableInvoice, transactionBilling } from "@/lib/billing";
import { formatPercentBp, parsePercentToBp, payoutCents } from "@/lib/billing-payouts";
import { optStr, str } from "@/lib/forms";
import { fmtCents, parseFeeCents, totalCents } from "@/lib/pay";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

/**
 * Per-transaction user pay: admins set the fee, the user requests payment for
 * the fees that are due, an admin marks the request paid. No money moves
 * through Freehold — this is the record and the statement.
 */

/**
 * Admin: what this user is paid for this file — a flat amount, or a
 * percentage of the file's fee revenue (outsourced files). Blank clears it;
 * setting one basis clears the other so there's never ambiguity about what a
 * person is owed.
 */
export async function setAssigneeFee(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id) return;
  const mode = str(formData, "feeMode") === "percent" ? "percent" : "flat";
  const raw = mode === "percent" ? str(formData, "feePercent") : str(formData, "feeCents");
  let feeCents: number | null = null;
  let feePercentBp: number | null = null;
  if (raw !== "") {
    if (mode === "percent") {
      feePercentBp = parsePercentToBp(raw);
      if (feePercentBp === null) return; // unparseable — leave it alone
    } else {
      feeCents = parseFeeCents(raw);
      if (feeCents === null) return;
    }
  }

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
      data: { feeCents, feePercentBp },
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
      feeCents === null && feePercentBp === null
        ? `Cleared ${updated.user.name}'s fee on ${updated.transaction.propertyAddress}`
        : feePercentBp !== null
          ? `Set ${updated.user.name}'s fee on ${updated.transaction.propertyAddress} to ${formatPercentBp(feePercentBp)} of fee revenue`
          : `Set ${updated.user.name}'s fee on ${updated.transaction.propertyAddress} to ${fmtCents(feeCents ?? 0)}`,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/profile");
}

/** One assignment eligible to go onto a pay request. */
interface PayableRow {
  id: string;
  feeCents: number | null;
  feePercentBp: number | null;
  transactionId: string;
  transaction: { propertyAddress: string };
}

/**
 * Freeze what each assignment is worth today. A flat fee is already a number;
 * a percentage is resolved against the file's *collected* revenue at this
 * moment, because that's the share actually in the door. Rows worth nothing
 * yet are dropped — a percent of nothing-collected isn't payable.
 */
async function freezePayable(
  tx: TenantTx,
  rows: PayableRow[],
): Promise<{ row: PayableRow; cents: number }[]> {
  const pctFiles = [
    ...new Set(rows.filter((r) => r.feePercentBp != null).map((r) => r.transactionId)),
  ];
  const invoices: AttributableInvoice[] =
    pctFiles.length > 0
      ? await tx.invoice.findMany({
          where: {
            OR: [
              { transactionId: { in: pctFiles } },
              { lines: { some: { transactionId: { in: pctFiles } } } },
            ],
          },
          select: {
            status: true,
            provider: true,
            transactionId: true,
            amountCents: true,
            lines: { select: { transactionId: true, amountCents: true } },
            payments: { select: { amountCents: true } },
          },
        })
      : [];
  return rows
    .map((row) => ({
      row,
      cents:
        row.feeCents ??
        payoutCents(
          { feeCents: null, feePercentBp: row.feePercentBp },
          transactionBilling(row.transactionId, invoices).paidCents,
        ),
    }))
    .filter((f) => f.cents > 0);
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
    // Only this user's own assignments, only ones with a basis set, and only
    // ones never billed before (the unique assignee_id also enforces this).
    const rows = await tx.transactionAssignee.findMany({
      where: {
        id: { in: assigneeIds },
        userId,
        OR: [{ feeCents: { not: null } }, { feePercentBp: { not: null } }],
        paymentItem: { is: null },
      },
      select: {
        id: true,
        feeCents: true,
        feePercentBp: true,
        transactionId: true,
        transaction: { select: { propertyAddress: true } },
      },
    });
    if (rows.length === 0) return null;

    const payable = await freezePayable(tx, rows);
    if (payable.length === 0) return null;

    return tx.paymentRequest.create({
      data: {
        tenantId,
        userId,
        note: optStr(formData, "note"),
        items: {
          create: payable.map(({ row, cents }) => ({
            tenantId,
            assigneeId: row.id,
            transactionId: row.transactionId,
            address: row.transaction.propertyAddress,
            feeCents: cents,
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

/**
 * Admin: approve one person's payout on one file without waiting for them to
 * ask. Same freeze rules as a self-submitted request — the amount is fixed at
 * today's figure and the assignment locks — so a payout approved from the file
 * and one requested from a profile produce an identical statement. The pay
 * request is raised in the teammate's name, because they are who gets paid.
 */
export async function approveAssigneePayout(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id) return;

  const created = await withTenant(tenantId, async (tx) => {
    const row = await tx.transactionAssignee.findFirst({
      where: {
        id,
        OR: [{ feeCents: { not: null } }, { feePercentBp: { not: null } }],
        paymentItem: { is: null },
      },
      select: {
        id: true,
        userId: true,
        feeCents: true,
        feePercentBp: true,
        transactionId: true,
        transaction: { select: { propertyAddress: true } },
        user: { select: { name: true } },
      },
    });
    if (!row) return null;

    const payable = await freezePayable(tx, [row]);
    if (payable.length === 0) return null;

    const request = await tx.paymentRequest.create({
      data: {
        tenantId,
        userId: row.userId,
        note: optStr(formData, "note"),
        items: {
          create: payable.map(({ row: r, cents }) => ({
            tenantId,
            assigneeId: r.id,
            transactionId: r.transactionId,
            address: r.transaction.propertyAddress,
            feeCents: cents,
          })),
        },
      },
      select: { id: true, items: { select: { feeCents: true } } },
    });
    return { request, name: row.user.name, address: row.transaction.propertyAddress };
  });
  if (!created) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "pay.requested",
    summary: `Approved ${created.name}'s ${fmtCents(totalCents(created.request.items))} payout on ${created.address}`,
  });
  if (transactionId) revalidatePath(`/dashboard/transactions/${transactionId}`);
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
        items: { select: { feeCents: true, transactionId: true } },
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
  // A request can span files; refresh every one it touched, so the payout
  // line on each of those pages stops saying "requested".
  for (const fileId of new Set(paid.items.map((i) => i.transactionId).filter(Boolean))) {
    revalidatePath(`/dashboard/transactions/${fileId}`);
  }
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
