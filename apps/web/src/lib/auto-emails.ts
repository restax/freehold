import { prisma, withTenant } from "@freehold/db";
import { after } from "next/server";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import { parseEmailPrefs } from "@/lib/email-prefs";
import {
  type EmailContact,
  parseEmailSettings,
  parseEmailTemplates,
  renderEmailHtml,
  renderMerge,
} from "@/lib/email-template";
import { fmtDate } from "@/lib/format";
import { parseAppearance, resolveEmailAccent } from "@/lib/theme";

/**
 * Automated lifecycle emails (intro on file open, congratulations on
 * close) plus the shared signature-block context every branded email uses.
 * Per-client switches live on the client profile (Client.emailPrefs);
 * everything here is fire-and-forget — a mail failure never breaks the
 * user's action.
 */

/**
 * Who the email is from, as the callers have them. Nearly every caller passes
 * `session.user`, which carries no phone — so the number is looked up from the
 * id rather than being threaded through a dozen signatures.
 */
export interface TcIdentity {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * The coordinator's contact number for the signature card. Already-known
 * values win; otherwise one lookup by id. Never throws — an email must still
 * go out if the profile read fails.
 */
export async function tcPhone(tc: TcIdentity): Promise<string | null> {
  if (tc.phone !== undefined && tc.phone !== null) return tc.phone;
  if (!tc.id) return null;
  return prisma.user
    .findUnique({ where: { id: tc.id }, select: { phone: true } })
    .then((u) => u?.phone ?? null)
    .catch(() => null);
}

/**
 * Signature-block contacts for a transaction's branded emails.
 *
 * `signatureId` picks a specific block from the workspace's library (the
 * compose form's dropdown); omitted, this reaches for whichever block is
 * marked default. Only once a workspace has never set one up does the card
 * fall back to the sender's own name/email/phone — the pre-signature-block
 * behavior, kept so an empty library doesn't leave automated mail blank.
 */
export async function emailContextForTransaction(
  tenantId: string,
  transactionId: string,
  tc: TcIdentity,
  signatureId?: string | null,
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
    select: { name: true, emailTemplates: true, emailSettings: true, appearanceConfig: true },
  });
  const emailAccent = resolveEmailAccent(parseAppearance(org.appearanceConfig));

  // "none" is a deliberate choice — "just my own info" in the compose
  // picker — distinct from not specifying one at all, which is every
  // automated send: those have no sender to ask, so they get the default.
  const signature =
    signatureId === "none"
      ? null
      : await withTenant(tenantId, (tx) =>
          signatureId
            ? tx.emailSignature.findUnique({ where: { id: signatureId } })
            : tx.emailSignature.findFirst({ where: { isDefault: true } }),
        );

  const tcCard: EmailContact = signature
    ? {
        heading: "Your transaction coordinator",
        name: signature.displayName,
        company: [signature.title, signature.company].filter(Boolean).join(", ") || org.name,
        email: signature.email,
        phone: signature.phone,
      }
    : {
        heading: "Your transaction coordinator",
        name: tc.name || org.name,
        company: org.name,
        email: tc.email,
        phone: await tcPhone(tc),
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

  return { txn, org, tcCard, agentCard, otherCard, emailAccent };
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
  tc: TcIdentity,
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
      accent: ctx.emailAccent,
      ...parseEmailSettings(ctx.org.emailSettings),
    }),
  });
}

// Fire-and-forget helpers schedule through next/server's after(): work
// queued this way survives the server action's response (waitUntil on
// Vercel) — a bare floating promise gets dropped when the request ends.
export function fireIntroEmail(tenantId: string, transactionId: string, tc: TcIdentity) {
  after(() => sendLifecycleEmail("intro", tenantId, transactionId, tc).catch(() => {}));
}

export function firePostCloseEmail(tenantId: string, transactionId: string, tc: TcIdentity) {
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
  tc: TcIdentity,
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
