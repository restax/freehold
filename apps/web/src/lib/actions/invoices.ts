"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { str } from "@/lib/forms";
import { getTenantPlan, isCloud } from "@/lib/plans";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * Client invoicing (tenant bills their client) through the configured Stripe
 * account. Self-hosted: your own STRIPE_SECRET_KEY. Cloud: Business plan;
 * per-tenant Stripe Connect accounts are on the roadmap and will slot in here.
 */

export async function invoicingEnabled(): Promise<boolean> {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function invoicingAllowed(tenantId: string): Promise<boolean> {
  if (!(await invoicingEnabled())) return false;
  if (!isCloud()) return true;
  const plan = await getTenantPlan(tenantId);
  return plan.tier === "BUSINESS" || plan.tier === "PRO";
}

function stripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY as string);
}

export async function createInvoice(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin || !(await invoicingAllowed(tenantId))) return;

  const clientId = str(formData, "clientId");
  const description = str(formData, "description") || "Transaction coordination services";
  const amount = Number.parseFloat(str(formData, "amount"));
  if (!clientId || !Number.isFinite(amount) || amount <= 0) return;
  const amountCents = Math.round(amount * 100);
  const transactionId = str(formData, "transactionId") || null;

  const client = await withTenant(tenantId, (tx) =>
    tx.client.findUnique({ where: { id: clientId } }),
  );
  if (!client?.email) return;

  const stripe = stripeClient();
  const existing = await stripe.customers.list({ email: client.email, limit: 1 });
  const customer =
    existing.data[0] ??
    (await stripe.customers.create({
      email: client.email,
      name: client.name,
      metadata: { freeholdTenantId: tenantId, freeholdClientId: client.id },
    }));

  const draft = await stripe.invoices.create({
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: 30,
    currency: "usd",
    metadata: { freeholdTenantId: tenantId },
  });
  await stripe.invoiceItems.create({
    customer: customer.id,
    invoice: draft.id,
    amount: amountCents,
    currency: "usd",
    description,
  });
  const finalized = await stripe.invoices.finalizeInvoice(draft.id as string);

  await withTenant(tenantId, (tx) =>
    tx.invoice.create({
      data: {
        tenantId,
        clientId,
        transactionId,
        description,
        amountCents,
        stripeInvoiceId: finalized.id,
        hostedUrl: finalized.hosted_invoice_url ?? null,
      },
    }),
  );
  revalidatePath("/dashboard/invoices");
}

export async function voidInvoice(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  const invoice = await withTenant(tenantId, (tx) => tx.invoice.findUnique({ where: { id } }));
  if (invoice?.status !== "SENT") return;
  if (invoice.stripeInvoiceId && (await invoicingEnabled())) {
    await stripeClient()
      .invoices.voidInvoice(invoice.stripeInvoiceId)
      .catch(() => {});
  }
  await withTenant(tenantId, (tx) =>
    tx.invoice.update({ where: { id }, data: { status: "VOID" } }),
  );
  revalidatePath("/dashboard/invoices");
}
