import { prisma, withTenant } from "@freehold/db";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import {
  type EmailContact,
  parseEmailTemplates,
  renderEmailHtml,
  renderMerge,
} from "@/lib/email-template";
import { fmtDate } from "@/lib/format";

/**
 * Automated lifecycle emails (intro on file open, congratulations on
 * close) plus the shared signature-block context every branded email uses.
 * Per-client switches live on the client profile (Client.emailPrefs);
 * everything here is fire-and-forget — a mail failure never breaks the
 * user's action.
 */

interface ClientEmailPrefs {
  intro?: boolean;
  postClose?: boolean;
}

export function parseEmailPrefs(raw: unknown): Required<ClientEmailPrefs> {
  const c = raw as ClientEmailPrefs | null;
  return { intro: c?.intro !== false, postClose: c?.postClose !== false };
}

/** Signature-block contacts for a transaction's branded emails. */
export async function emailContextForTransaction(
  tenantId: string,
  transactionId: string,
  tc: { name?: string | null; email?: string | null },
) {
  const txn = await withTenant(tenantId, (tx) =>
    tx.transaction.findUnique({
      where: { id: transactionId },
      include: { client: true, parties: { include: { contact: true } } },
    }),
  );
  if (!txn) return null;

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { name: true, emailTemplates: true },
  });

  const tcCard: EmailContact = {
    heading: "Your transaction coordinator",
    name: tc.name || org.name,
    company: org.name,
    email: tc.email,
  };

  const agentCard: EmailContact | null = txn.client
    ? {
        heading: "Your agent",
        name: txn.client.name,
        email: txn.client.email,
        phone: txn.client.phone,
      }
    : null;

  const otherRole = txn.side === "BUY_SIDE" ? "LISTING_AGENT" : "BUYER_AGENT";
  const other = txn.parties.find((p) => p.role === otherRole);
  const otherCard: EmailContact | null = other
    ? {
        heading: txn.side === "BUY_SIDE" ? "Listing side" : "Buyer side",
        name: other.contact.name,
        email: other.contact.email,
        phone: other.contact.phone,
      }
    : null;

  return { txn, org, tcCard, agentCard, otherCard };
}

async function sendLifecycleEmail(
  kind: "intro" | "postClose",
  tenantId: string,
  transactionId: string,
  tc: { name?: string | null; email?: string | null },
) {
  if (!emailEnabled()) return;
  const ctx = await emailContextForTransaction(tenantId, transactionId, tc);
  if (!ctx?.txn.client?.email) return;
  // Sample/demo data uses reserved .example addresses — never actually send.
  if (/\.(example|test|invalid)$/i.test(ctx.txn.client.email.split("@")[1] ?? "")) return;
  if (!parseEmailPrefs(ctx.txn.client.emailPrefs)[kind]) return;

  const template = parseEmailTemplates(ctx.org.emailTemplates)[kind];
  const merge = {
    client_name: ctx.txn.client.name,
    property_address: ctx.txn.propertyAddress,
    close_date: ctx.txn.closeDate ? fmtDate(ctx.txn.closeDate) : "",
    contract_date: ctx.txn.contractDate ? fmtDate(ctx.txn.contractDate) : "",
    tc_name: tc.name ?? ctx.org.name,
    tenant_name: ctx.org.name,
  };
  const body = renderMerge(template.body, merge);
  await sendTenantEmail({
    tenantId,
    transactionId,
    to: ctx.txn.client.email,
    subject: renderMerge(template.subject, merge),
    body,
    html: renderEmailHtml({
      tenantName: ctx.org.name,
      body,
      tc: ctx.tcCard,
      agent: ctx.agentCard,
      otherSide: ctx.otherCard,
    }),
  });
}

export function fireIntroEmail(
  tenantId: string,
  transactionId: string,
  tc: { name?: string | null; email?: string | null },
) {
  sendLifecycleEmail("intro", tenantId, transactionId, tc).catch(() => {});
}

export function firePostCloseEmail(
  tenantId: string,
  transactionId: string,
  tc: { name?: string | null; email?: string | null },
) {
  sendLifecycleEmail("postClose", tenantId, transactionId, tc).catch(() => {});
}
