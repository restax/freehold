import { prisma, withTenant } from "@freehold/db";
import { autoDraftTarget, committedCents } from "@/lib/billing";
import { clientBillingPolicy } from "@/lib/billing-policy";
import { nextInvoiceNumber } from "@/lib/invoicing";
import { getTenantPlan, isCloud } from "@/lib/plans";

/**
 * Event-driven auto-drafts: when a file is opened or closes, the client's
 * billing policy may call for an invoice. Freehold prepares a DRAFT — never
 * a sent invoice — so the moment is captured but a person still reviews and
 * issues it. Drafts carry no follow-up task and don't count as "billed";
 * they're the machine putting paper on the desk, not signing it.
 *
 * Idempotent by arithmetic: the target is clamped to expected − (issued +
 * already-drafted), so re-firing a moment (file closed twice, edits) can
 * never stack a second draft for the same money.
 */
export async function ensureAutoDraft(
  tenantId: string,
  transactionId: string,
  phase: "entry" | "close",
): Promise<void> {
  try {
    // Client invoicing is a paid-plan feature on Cloud; policy silently
    // doesn't act for Free workspaces (same gate as manual invoicing).
    if (isCloud()) {
      const plan = await getTenantPlan(tenantId);
      if (plan.tier !== "PRO" && plan.tier !== "BUSINESS") return;
    }
    const org = await prisma.organization.findUnique({
      where: { id: tenantId },
      select: { billingDefaults: true },
    });

    await withTenant(tenantId, async (tx) => {
      const txn = await tx.transaction.findUnique({
        where: { id: transactionId },
        select: {
          clientId: true,
          expectedFeeCents: true,
          propertyAddress: true,
          client: { select: { billingConfig: true } },
        },
      });
      if (!txn?.clientId) return; // nobody to bill

      const policy = clientBillingPolicy(org?.billingDefaults, txn.client?.billingConfig);
      const invoices = await tx.invoice.findMany({
        where: { OR: [{ transactionId }, { lines: { some: { transactionId } } }] },
        select: {
          status: true,
          provider: true,
          transactionId: true,
          amountCents: true,
          lines: { select: { transactionId: true, amountCents: true } },
          payments: { select: { amountCents: true } },
        },
      });
      const target = autoDraftTarget(
        policy.mode,
        phase,
        txn.expectedFeeCents,
        policy.depositPercent,
        committedCents(transactionId, invoices),
      );
      if (target <= 0) return;

      const isDeposit = phase === "entry" && policy.mode === "upfront_deposit";
      const description = `${isDeposit ? "Deposit — transaction" : "Transaction"} coordination: ${txn.propertyAddress}`;
      const number = await nextInvoiceNumber(tx, tenantId);
      await tx.invoice.create({
        data: {
          tenantId,
          clientId: txn.clientId,
          transactionId,
          number,
          status: "DRAFT",
          description,
          amountCents: target,
          paymentTerms: phase === "close" ? "Due at closing" : null,
          lines: {
            create: {
              tenantId,
              transactionId,
              kind: isDeposit ? "deposit" : "service",
              description,
              amountCents: target,
            },
          },
        },
      });
    });
  } catch {
    // Auto-drafts are a convenience: a failure here must never break saving
    // the file itself. The billing panel always allows drafting by hand.
  }
}
