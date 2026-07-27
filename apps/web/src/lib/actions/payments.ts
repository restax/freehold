"use server";

import { prisma, TaskStatus, type TenantTx, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { logAudit } from "@/lib/audit";
import { invoiceMoney, maxCreditApplication, settlesInvoice } from "@/lib/billing";
import { clientBillingPolicy, lateFeeCents } from "@/lib/billing-policy";
import { dateOnly, optStr, str } from "@/lib/forms";
import { invoiceLabel } from "@/lib/invoicing";
import { fmtCents, parseFeeCents } from "@/lib/pay";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * Incoming money. Everything here writes append-only ledger entries — a
 * mistake is corrected by a reversal, a bounced check by a reversing entry
 * pointing at the original, never by editing history. Status follows the
 * ledger: an invoice flips to PAID the moment entries cover it, and back to
 * SENT the moment a reversal uncovers it (reopening the follow-up nag).
 *
 * ERPNext-provider invoices are excluded throughout: their ERP is the record
 * and Freehold only mirrors status.
 */

function revalidateInvoice(transactionId: string | null) {
  revalidatePath("/dashboard/invoices");
  if (transactionId) revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/** Flip status to match the ledger, opening/closing the follow-up with it. */
async function syncStatusWithLedger(tx: TenantTx, invoiceId: string) {
  const inv = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: {
      status: true,
      followUpTaskId: true,
      lines: { select: { amountCents: true } },
      payments: { select: { amountCents: true } },
    },
  });
  const settled = settlesInvoice(invoiceMoney(inv.lines, inv.payments));
  if (inv.status === "SENT" && settled) {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (inv.followUpTaskId) {
      await tx.task.updateMany({
        where: { id: inv.followUpTaskId, status: TaskStatus.OPEN },
        data: { status: TaskStatus.DONE, completedAt: new Date() },
      });
    }
  } else if (inv.status === "PAID" && !settled) {
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: "SENT", paidAt: null } });
    if (inv.followUpTaskId) {
      // The nag comes back: there's money to chase again.
      await tx.task.updateMany({
        where: { id: inv.followUpTaskId, status: TaskStatus.DONE },
        data: { status: TaskStatus.OPEN, completedAt: null },
      });
    }
  }
}

/** Record money received against an invoice — partial amounts welcome. */
export async function recordInvoicePayment(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  const amountCents = parseFeeCents(str(formData, "amount"));
  if (!id || amountCents === null || amountCents <= 0) return;
  const receivedAt = dateOnly(formData, "receivedAt");

  const recorded = await withTenant(tenantId, async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id },
      select: { status: true, provider: true, number: true, transactionId: true },
    });
    if (inv?.provider !== "freehold" || (inv.status !== "SENT" && inv.status !== "PAID")) {
      return null;
    }
    await tx.invoicePayment.create({
      data: {
        tenantId,
        invoiceId: id,
        amountCents,
        method: optStr(formData, "method"),
        reference: optStr(formData, "reference"),
        note: optStr(formData, "note"),
        recordedByName: session.user.name,
        ...(receivedAt ? { receivedAt } : {}),
      },
    });
    await syncStatusWithLedger(tx, id);
    return inv;
  });
  if (!recorded) return;

  logActivity({
    tenantId,
    transactionId: recorded.transactionId,
    actor: session.user,
    action: "payment.recorded",
    summary: `Recorded ${fmtCents(amountCents)} payment on ${invoiceLabel(recorded.number)}`,
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "payment.recorded",
    summary: `${fmtCents(amountCents)} on ${invoiceLabel(recorded.number)}${
      optStr(formData, "method") ? ` (${optStr(formData, "method")})` : ""
    }`,
  });
  revalidateInvoice(recorded.transactionId);
}

/** Reverse a payment entry (returned check, recorded in error). */
export async function reverseInvoicePayment(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const paymentId = str(formData, "paymentId");
  if (!paymentId) return;
  const note = optStr(formData, "note") ?? "Payment reversed";

  const reversed = await withTenant(tenantId, async (tx) => {
    const original = await tx.invoicePayment.findUnique({
      where: { id: paymentId },
      include: {
        reversedBy: { select: { amountCents: true } },
        invoice: { select: { id: true, number: true, provider: true, transactionId: true } },
      },
    });
    // Only positive, not-yet-reversed direct entries reverse. Credit-sourced
    // payments go back through the credit ledger so both books stay whole.
    if (!original || original.amountCents <= 0 || original.source !== "direct") return null;
    if (original.reversedBy.reduce((s, r) => s + r.amountCents, 0) < 0) return null;
    if (original.invoice.provider !== "freehold") return null;

    await tx.invoicePayment.create({
      data: {
        tenantId,
        invoiceId: original.invoice.id,
        amountCents: -original.amountCents,
        note,
        reversesId: original.id,
        recordedByName: session.user.name,
      },
    });
    await syncStatusWithLedger(tx, original.invoice.id);
    return original;
  });
  if (!reversed) return;

  logActivity({
    tenantId,
    transactionId: reversed.invoice.transactionId,
    actor: session.user,
    action: "payment.reversed",
    summary: `Reversed ${fmtCents(reversed.amountCents)} on ${invoiceLabel(reversed.invoice.number)} — ${note}`,
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "payment.reversed",
    summary: `Reversed ${fmtCents(reversed.amountCents)} on ${invoiceLabel(reversed.invoice.number)} — ${note}`,
  });
  revalidateInvoice(reversed.invoice.transactionId);
}

/** Put money on (or take it off) a client's account: deposit, refund, adjustment. */
export async function recordClientCredit(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const clientId = str(formData, "clientId");
  const kindRaw = str(formData, "kind");
  const amountCents = parseFeeCents(str(formData, "amount"));
  if (!clientId || amountCents === null || amountCents <= 0) return;
  if (!["deposit", "refund", "adjustment_add", "adjustment_remove"].includes(kindRaw)) return;
  const negative = kindRaw === "refund" || kindRaw === "adjustment_remove";
  const kind = kindRaw.startsWith("adjustment") ? "adjustment" : kindRaw;

  const done = await withTenant(tenantId, async (tx) => {
    const client = await tx.client.findUnique({ where: { id: clientId }, select: { name: true } });
    if (!client) return null;
    if (negative) {
      const entries = await tx.clientCreditEntry.findMany({
        where: { clientId },
        select: { amountCents: true },
      });
      const balance = entries.reduce((s, e) => s + e.amountCents, 0);
      if (amountCents > balance) return { failed: true, name: client.name } as const;
    }
    await tx.clientCreditEntry.create({
      data: {
        tenantId,
        clientId,
        amountCents: negative ? -amountCents : amountCents,
        kind,
        method: optStr(formData, "method"),
        reference: optStr(formData, "reference"),
        note: optStr(formData, "note"),
        recordedByName: session.user.name,
      },
    });
    return { failed: false, name: client.name } as const;
  });
  if (!done || done.failed) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "credit.recorded",
    summary: `${negative ? "-" : "+"}${fmtCents(amountCents)} on account for ${done.name} (${kind})`,
  });
  revalidatePath("/dashboard/invoices");
}

/**
 * Pay an invoice from the client's on-account balance. One transaction writes
 * both sides — the credit "applied" entry and the invoice payment — clamped
 * so neither ledger can go negative.
 */
export async function applyClientCredit(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  const requested = parseFeeCents(str(formData, "amount"));
  if (!id || requested === null || requested <= 0) return;

  const applied = await withTenant(tenantId, async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id },
      select: {
        status: true,
        provider: true,
        number: true,
        clientId: true,
        transactionId: true,
        lines: { select: { amountCents: true } },
        payments: { select: { amountCents: true } },
      },
    });
    if (!inv?.clientId || inv.provider !== "freehold" || inv.status !== "SENT") return null;
    const entries = await tx.clientCreditEntry.findMany({
      where: { clientId: inv.clientId },
      select: { amountCents: true },
    });
    const creditBalance = entries.reduce((s, e) => s + e.amountCents, 0);
    const invoiceBalance = invoiceMoney(inv.lines, inv.payments).balanceCents;
    const amount = Math.min(requested, maxCreditApplication(creditBalance, invoiceBalance));
    if (amount <= 0) return null;

    const creditEntry = await tx.clientCreditEntry.create({
      data: {
        tenantId,
        clientId: inv.clientId,
        amountCents: -amount,
        kind: "applied",
        invoiceId: id,
        note: `Applied to ${invoiceLabel(inv.number)}`,
        recordedByName: session.user.name,
      },
    });
    await tx.invoicePayment.create({
      data: {
        tenantId,
        invoiceId: id,
        amountCents: amount,
        method: "On-account credit",
        source: "credit",
        creditEntryId: creditEntry.id,
        recordedByName: session.user.name,
      },
    });
    await syncStatusWithLedger(tx, id);
    return { ...inv, amount };
  });
  if (!applied) return;

  logActivity({
    tenantId,
    transactionId: applied.transactionId,
    actor: session.user,
    action: "credit.applied",
    summary: `Applied ${fmtCents(applied.amount)} client credit to ${invoiceLabel(applied.number)}`,
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "credit.applied",
    summary: `${fmtCents(applied.amount)} credit → ${invoiceLabel(applied.number)}`,
  });
  revalidateInvoice(applied.transactionId);
}

/**
 * Add the policy's late fee to an overdue invoice. Always a person clicking a
 * suggestion — never automatic — and at most one per invoice.
 */
export async function addLateFee(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  if (!id) return;
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { billingDefaults: true },
  });

  const added = await withTenant(tenantId, async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id },
      select: {
        status: true,
        provider: true,
        number: true,
        amountCents: true,
        transactionId: true,
        client: { select: { billingConfig: true } },
        lines: { select: { kind: true } },
      },
    });
    if (inv?.provider !== "freehold" || inv.status !== "SENT") return null;
    if (inv.lines.some((l) => l.kind === "late_fee")) return null;
    const policy = clientBillingPolicy(org?.billingDefaults, inv.client?.billingConfig);
    const fee = lateFeeCents(policy.lateFee, inv.amountCents);
    if (fee <= 0) return null;
    await tx.invoiceLine.create({
      data: {
        tenantId,
        invoiceId: id,
        transactionId: inv.transactionId,
        kind: "late_fee",
        description: "Late fee",
        amountCents: fee,
      },
    });
    await tx.invoice.update({ where: { id }, data: { amountCents: { increment: fee } } });
    return { ...inv, fee };
  });
  if (!added) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "invoice.late_fee",
    summary: `Late fee ${fmtCents(added.fee)} added to ${invoiceLabel(added.number)}`,
  });
  revalidateInvoice(added.transactionId);
}
