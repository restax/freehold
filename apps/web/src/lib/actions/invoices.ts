"use server";

import { prisma, TaskStatus, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import {
  createSalesInvoice,
  decodeErpnextConfig,
  fetchInvoiceStatus,
  parseErpnextConfig,
} from "@/lib/erpnext";
import { dateOnly, optStr, str } from "@/lib/forms";
import { invoiceLabel, invoiceText, nextInvoiceNumber } from "@/lib/invoicing";
import { fmtCents, parseFeeCents } from "@/lib/pay";
import { getTenantPlan, isCloud } from "@/lib/plans";
import { renderTemplatePdf } from "@/lib/templates";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * Client invoicing (tenant bills their client) with no payment processor.
 * Clients pay by check, Zelle, wire, or out of closing proceeds; Freehold
 * generates the invoice, emails it, and nags until the tenant marks it
 * resolved. A follow-up task is the nag: opened when the invoice is issued,
 * closed automatically when it's paid or voided.
 */

export async function invoicingAllowed(tenantId: string): Promise<boolean> {
  if (!isCloud()) return true;
  const plan = await getTenantPlan(tenantId);
  return plan.tier === "BUSINESS" || plan.tier === "PRO";
}

/** The tenant's decrypted ERPNext connection, or null when not connected. */
async function loadErpnextConnection(tenantId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { erpnextConfig: true },
  });
  const cfg = parseErpnextConfig(org?.erpnextConfig);
  return cfg ? decodeErpnextConfig(cfg) : null;
}

/** Whether the ERPNext option should be offered at all. */
export async function erpnextConnected(tenantId: string): Promise<boolean> {
  return (await loadErpnextConnection(tenantId)) !== null;
}

/**
 * Pull the current status for every ERPNext-backed outstanding invoice.
 * Their ERP is the record for those, so this is a mirror, not a guess — and a
 * mirrored PAID closes the follow-up task exactly like marking it here would.
 */
export async function refreshErpnextInvoices(_formData?: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const conn = await loadErpnextConnection(tenantId);
  if (!conn) return;

  const open = await withTenant(tenantId, (tx) =>
    tx.invoice.findMany({
      where: { provider: "erpnext", status: "SENT", externalId: { not: null } },
      select: { id: true, externalId: true, followUpTaskId: true },
    }),
  );
  for (const inv of open) {
    const remote = await fetchInvoiceStatus(conn, inv.externalId as string);
    if (!remote.ok || remote.status === "SENT") continue;
    await withTenant(tenantId, async (tx) => {
      await tx.invoice.update({
        where: { id: inv.id },
        data:
          remote.status === "PAID"
            ? { status: "PAID", paidAt: new Date(), paidNote: "Marked paid in ERPNext" }
            : { status: "VOID" },
      });
      if (inv.followUpTaskId) {
        await tx.task.updateMany({
          where: { id: inv.followUpTaskId, status: TaskStatus.OPEN },
          data: { status: TaskStatus.DONE, completedAt: new Date() },
        });
      }
    });
  }
  revalidatePath("/dashboard/invoices");
}

export async function createInvoice(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin || !(await invoicingAllowed(tenantId))) return;

  const clientId = str(formData, "clientId");
  const description = str(formData, "description") || "Transaction coordination services";
  const amountCents = parseFeeCents(str(formData, "amount"));
  if (!clientId || amountCents === null || amountCents <= 0) return;
  const transactionId = optStr(formData, "transactionId");
  const paymentTerms = optStr(formData, "paymentTerms");
  const dueDate = dateOnly(formData, "dueDate");
  const useErpnext = str(formData, "provider") === "erpnext";

  const created = await withTenant(tenantId, async (tx) => {
    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { name: true },
    });
    if (!client) return null;

    const number = await nextInvoiceNumber(tx, tenantId);

    // Routed to the tenant's ERPNext: create it there first, and abandon the
    // whole thing if their instance refuses — a Freehold row pointing at an
    // invoice that doesn't exist would be worse than no invoice.
    let externalId: string | null = null;
    if (useErpnext) {
      const conn = await loadErpnextConnection(tenantId);
      if (!conn) return { failed: "ERPNext isn't connected." } as const;
      const remote = await createSalesInvoice(conn, {
        customerName: client.name,
        description,
        amountCents,
        dueDate,
        reference: invoiceLabel(number),
      });
      if (!remote.ok) return { failed: remote.error } as const;
      externalId = remote.name;
    }

    // The nag: stays open until the invoice is resolved. Due when the
    // invoice is due, else two weeks out — a check-in, not a deadline.
    const task = await tx.task.create({
      data: {
        tenantId,
        transactionId,
        title: `Follow up: ${invoiceLabel(number)} — ${client.name} (${fmtCents(amountCents)})`,
        dueDate: dueDate ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        assigneeId: session.user.id,
      },
    });
    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        clientId,
        transactionId,
        number,
        provider: useErpnext ? "erpnext" : "freehold",
        externalId,
        description,
        amountCents,
        paymentTerms,
        dueDate,
        followUpTaskId: task.id,
      },
    });
    return { invoice, clientName: client.name };
  });
  if (!created) return;
  if ("failed" in created) {
    redirect(
      `/dashboard/invoices?invoiceError=${encodeURIComponent(`Not issued — ${created.failed}`)}`,
    );
  }

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "invoice.created",
    summary: `Issued ${invoiceLabel(created.invoice.number)} to ${created.clientName} — ${fmtCents(
      created.invoice.amountCents,
    )}${created.invoice.externalId ? ` (ERPNext ${created.invoice.externalId})` : ""}`,
  });
  revalidatePath("/dashboard/invoices");
  if (transactionId) revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/** Email the invoice to the client, PDF attached. */
export async function sendInvoice(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin || !emailEnabled()) return;
  const id = str(formData, "id");
  if (!id) return;

  const invoice = await withTenant(tenantId, (tx) =>
    tx.invoice.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, email: true } },
        transaction: { select: { propertyAddress: true } },
      },
    }),
  );
  if (invoice?.status !== "SENT" || !invoice.client?.email) return;

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { name: true },
  });
  const text = invoiceText({
    number: invoice.number,
    workspaceName: org.name,
    clientName: invoice.client.name,
    description: invoice.description,
    amountCents: invoice.amountCents,
    paymentTerms: invoice.paymentTerms,
    dueDate: invoice.dueDate,
    issuedOn: invoice.createdAt,
    transactionAddress: invoice.transaction?.propertyAddress ?? null,
  });
  const pdf = await renderTemplatePdf(`${org.name} — ${invoiceLabel(invoice.number)}`, text);

  await sendTenantEmail({
    tenantId,
    transactionId: invoice.transactionId,
    to: invoice.client.email,
    subject: `Invoice ${invoiceLabel(invoice.number)} from ${org.name} — ${fmtCents(invoice.amountCents)}`,
    body: text,
    attachments: [
      { filename: `${invoiceLabel(invoice.number)}.pdf`, content: pdf.toString("base64") },
    ],
  });
  await withTenant(tenantId, (tx) =>
    tx.invoice.update({ where: { id }, data: { sentAt: new Date() } }),
  );

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "invoice.sent",
    summary: `Emailed ${invoiceLabel(invoice.number)} to ${invoice.client.email}`,
  });
  revalidatePath("/dashboard/invoices");
  if (invoice.transactionId) revalidatePath(`/dashboard/transactions/${invoice.transactionId}`);
}

/**
 * The tenant says it's paid — by whatever means. Records how it was settled
 * and closes the follow-up task, since there's nothing left to chase.
 */
export async function markInvoicePaid(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  if (!id) return;

  const paid = await withTenant(tenantId, async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id },
      select: {
        status: true,
        number: true,
        amountCents: true,
        followUpTaskId: true,
        transactionId: true,
      },
    });
    if (invoice?.status !== "SENT") return null;
    await tx.invoice.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date(), paidNote: optStr(formData, "paidNote") },
    });
    if (invoice.followUpTaskId) {
      await tx.task.updateMany({
        where: { id: invoice.followUpTaskId, status: TaskStatus.OPEN },
        data: { status: TaskStatus.DONE, completedAt: new Date() },
      });
    }
    return invoice;
  });
  if (!paid) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "invoice.paid",
    summary: `${invoiceLabel(paid.number)} paid — ${fmtCents(paid.amountCents)}`,
  });
  revalidatePath("/dashboard/invoices");
  if (paid.transactionId) revalidatePath(`/dashboard/transactions/${paid.transactionId}`);
}

/** Withdraw an unpaid invoice; the follow-up closes with it. */
export async function voidInvoice(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  if (!id) return;

  const voided = await withTenant(tenantId, async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id },
      select: { status: true, number: true, followUpTaskId: true, transactionId: true },
    });
    if (invoice?.status !== "SENT") return null;
    await tx.invoice.update({ where: { id }, data: { status: "VOID" } });
    if (invoice.followUpTaskId) {
      await tx.task.updateMany({
        where: { id: invoice.followUpTaskId, status: TaskStatus.OPEN },
        data: { status: TaskStatus.DONE, completedAt: new Date() },
      });
    }
    return invoice;
  });
  if (!voided) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "invoice.voided",
    summary: `Voided ${invoiceLabel(voided.number)}`,
  });
  revalidatePath("/dashboard/invoices");
  if (voided.transactionId) revalidatePath(`/dashboard/transactions/${voided.transactionId}`);
}

/** The connected instance's base URL, for deep-linking invoice rows. */
export async function erpnextBaseUrl(tenantId: string): Promise<string | null> {
  const conn = await loadErpnextConnection(tenantId);
  return conn?.url ?? null;
}
