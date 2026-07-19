import { prisma, withTenant } from "@freehold/db";
import { after } from "next/server";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import {
  type EmailContact,
  parseEmailSettings,
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
    select: { name: true, emailTemplates: true, emailSettings: true },
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

/** Merge map for template rendering on a transaction (party names by role). */
export function transactionMergeContext(
  ctx: NonNullable<Awaited<ReturnType<typeof emailContextForTransaction>>>,
  tc: { name?: string | null },
): Record<string, string> {
  const party = (role: string) => ctx.txn.parties.find((p) => p.role === role)?.contact.name ?? "";
  return {
    client_name: ctx.txn.client?.name ?? "",
    property_address: ctx.txn.propertyAddress,
    close_date: ctx.txn.closeDate ? fmtDate(ctx.txn.closeDate) : "",
    contract_date: ctx.txn.contractDate ? fmtDate(ctx.txn.contractDate) : "",
    tc_name: tc.name ?? ctx.org.name,
    tenant_name: ctx.org.name,
    buyer_name: party("BUYER"),
    seller_name: party("SELLER"),
    buyer_agent_name: party("BUYER_AGENT"),
    listing_agent_name: party("LISTING_AGENT"),
    lender_name: party("LENDER"),
    title_company_name: party("TITLE_COMPANY"),
  };
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
      ...parseEmailSettings(ctx.org.emailSettings),
    }),
  });
}

// Fire-and-forget helpers schedule through next/server's after(): work
// queued this way survives the server action's response (waitUntil on
// Vercel) — a bare floating promise gets dropped when the request ends.
export function fireIntroEmail(
  tenantId: string,
  transactionId: string,
  tc: { name?: string | null; email?: string | null },
) {
  after(() => sendLifecycleEmail("intro", tenantId, transactionId, tc).catch(() => {}));
}

export function firePostCloseEmail(
  tenantId: string,
  transactionId: string,
  tc: { name?: string | null; email?: string | null },
) {
  after(() => sendLifecycleEmail("postClose", tenantId, transactionId, tc).catch(() => {}));
}

/**
 * Task-completion auto-send: the task's template, merged and delivered to
 * the client — deferred by quiet hours via the outbox. Fire-and-forget.
 */
export function fireTaskTemplateEmail(
  tenantId: string,
  transactionId: string,
  taskId: string,
  tc: { name?: string | null; email?: string | null },
) {
  after(async () => {
    if (!emailEnabled()) return;
    const ctx = await emailContextForTransaction(tenantId, transactionId, tc);
    if (!ctx?.txn.client?.email) return;
    if (/\.(example|test|invalid)$/i.test(ctx.txn.client.email.split("@")[1] ?? "")) return;
    const task = await withTenant(tenantId, (tx) =>
      tx.task.findUnique({
        where: { id: taskId },
        select: { title: true, dueDate: true, emailTemplateId: true, autoSendEmail: true },
      }),
    );
    if (!task?.autoSendEmail || !task.emailTemplateId) return;
    const template = await withTenant(tenantId, (tx) =>
      tx.emailTemplate.findUnique({ where: { id: task.emailTemplateId ?? "" } }),
    );
    if (!template) return;
    const merge = {
      ...transactionMergeContext(ctx, tc),
      task_title: task.title,
      task_due: task.dueDate ? fmtDate(task.dueDate) : "",
    };
    const { enqueueOrSend } = await import("@/lib/outbox");
    await enqueueOrSend({
      tenantId,
      transactionId,
      to: ctx.txn.client.email,
      subject: renderMerge(template.subject, merge),
      body: renderMerge(template.body, merge),
    });
    await withTenant(tenantId, (tx) =>
      tx.emailTemplate.update({
        where: { id: template.id },
        data: { usageCount: { increment: 1 } },
      }),
    ).catch(() => {});
  });
}
