"use server";

import { prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EMAIL_PHASES } from "@/lib/default-email-templates";
import { confirmed, optStr, str } from "@/lib/forms";
import { seedDefaultEmailTemplates } from "@/lib/seed-core";
import { listTenants } from "@/lib/session";
import { seedStarterLibrary } from "@/lib/starter-library-seed";
import { putObject } from "@/lib/storage";
import { buildMergeContext, renderTemplatePdf, resolveTemplate } from "@/lib/templates";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

export async function createTemplate(formData: FormData) {
  const { tenantId } = await requireTenant();
  const name = str(formData, "name");
  if (!name) return;
  const created = await withTenant(tenantId, (tx) =>
    tx.docTemplate.create({
      data: {
        tenantId,
        name,
        description: optStr(formData, "description"),
        body: str(formData, "body") || `# ${name}\n\n`,
      },
    }),
  );
  revalidatePath("/dashboard/templates");
  redirect(`/dashboard/templates/${created.id}`);
}

export async function updateTemplate(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) =>
    tx.docTemplate.update({
      where: { id },
      data: {
        name: str(formData, "name") || undefined,
        description: optStr(formData, "description"),
        body: String(formData.get("body") ?? ""),
      },
    }),
  );
  revalidatePath(`/dashboard/templates/${id}`);
  revalidatePath("/dashboard/templates");
}

export async function deleteTemplate(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const id = str(formData, "id");
  if (!id || !isAdmin || !confirmed(formData)) return;
  await withTenant(tenantId, (tx) => tx.docTemplate.delete({ where: { id } }));
  revalidatePath("/dashboard/templates");
  redirect("/dashboard/templates");
}

/** Render a template against a transaction and attach the PDF as a document. */
export async function generateDocument(formData: FormData) {
  const { tenantId } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const templateId = str(formData, "templateId");
  if (!transactionId || !templateId) return;

  const tenants = await listTenants();
  const tenantName = tenants.find((t) => t.id === tenantId)?.name ?? "";

  const { template, txn } = await withTenant(tenantId, async (tx) => ({
    template: await tx.docTemplate.findUniqueOrThrow({ where: { id: templateId } }),
    txn: await tx.transaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: { client: true, parties: { include: { contact: true } } },
    }),
  }));

  const ctx = buildMergeContext(txn, tenantName);
  const { text } = resolveTemplate(template.body, ctx);
  const pdf = await renderTemplatePdf(template.name, text);
  const filename = `${template.name.replace(/[^\w.\- ]/g, "_")}.pdf`;
  const stored = await putObject(tenantId, filename, pdf, "application/pdf");

  await withTenant(tenantId, (tx) =>
    tx.document.create({
      data: {
        tenantId,
        transactionId,
        filename,
        contentType: "application/pdf",
        sizeBytes: pdf.length,
        data: stored.data,
        storageKey: stored.storageKey,
        storageProvider: stored.storageProvider,
      },
    }),
  );
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/** Tenant overrides for the automated email templates (intro / post-close / review). */
export async function saveEmailTemplates(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const val = (k: string) => String(formData.get(k) ?? "").trim();
  const { prisma } = await import("@freehold/db");
  await prisma.organization.update({
    where: { id: tenantId },
    data: {
      emailTemplates: {
        intro: { subject: val("introSubject"), body: val("introBody") },
        postClose: { subject: val("postCloseSubject"), body: val("postCloseBody") },
        review: { subject: val("reviewSubject"), body: val("reviewBody") },
      },
    },
  });
  revalidatePath("/dashboard/emails");
}

/** Email template library CRUD (reusable merge-field emails). */
const EMAIL_CATEGORIES = EMAIL_PHASES.map((p) => p.key);

function templateFields(formData: FormData) {
  const cat = str(formData, "category");
  return {
    name: str(formData, "name"),
    subject: str(formData, "subject"),
    body: str(formData, "body"),
    category: EMAIL_CATEGORIES.includes(cat) ? cat : "GENERAL",
    taskMatch: optStr(formData, "taskMatch"),
    attachMatch: optStr(formData, "attachMatch"),
    groupId: optStr(formData, "groupId"),
    toDefault: optStr(formData, "toDefault"),
    ccDefault: optStr(formData, "ccDefault"),
    composeNote: optStr(formData, "composeNote"),
    filePlaceholders: optStr(formData, "filePlaceholders"),
  };
}

/** Re-add any built-in phase templates the workspace is missing (idempotent). */
export async function restoreDefaultTemplates() {
  const { tenantId } = await requireTenant();
  const added = await seedDefaultEmailTemplates(tenantId);
  revalidatePath("/dashboard/templates");
  redirect(`/dashboard/templates?tab=emails&restored=${added}`);
}

/**
 * Seed the built-in defaults for a freshly created workspace. Called from
 * onboarding regardless of the sample-data choice — defaults aren't sample
 * data. tenantId comes from the client, so membership is verified first.
 */
export async function seedDefaultTemplatesFor(tenantId: string) {
  const { userId } = await requireTenant();
  const membership = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId },
    select: { id: true },
  });
  if (!membership) return;
  await seedDefaultEmailTemplates(tenantId);
  await seedStarterLibrary(tenantId);
}

/** Re-add any missing starter-library templates (idempotent — never touches
 *  an edited copy, by name, across every template kind at once). */
export async function restoreStarterLibrary() {
  const { tenantId } = await requireTenant();
  const added = await seedStarterLibrary(tenantId);
  const total =
    added.emailTemplates + added.attachmentTemplates + added.dateTemplates + added.taskPlans;
  revalidatePath("/dashboard/templates");
  redirect(`/dashboard/templates?tab=tasks&restoredLibrary=${total}`);
}

export async function createEmailTemplateLib(formData: FormData) {
  const { tenantId } = await requireTenant();
  const f = templateFields(formData);
  if (!f.name || !f.subject || !f.body) return;
  const created = await withTenant(tenantId, (tx) =>
    tx.emailTemplate.create({ data: { tenantId, ...f } }),
  );
  revalidatePath("/dashboard/emails");
  revalidatePath("/dashboard/templates");
  redirect(`/dashboard/templates?tab=emails&templateId=${created.id}`);
}

export async function updateEmailTemplateLib(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const f = templateFields(formData);
  if (!id || !f.name || !f.subject || !f.body) return;
  await withTenant(tenantId, (tx) =>
    tx.emailTemplate.update({ where: { id }, data: { ...f, isSample: false } }),
  );
  revalidatePath("/dashboard/emails");
  revalidatePath("/dashboard/templates");
}

export async function deleteEmailTemplateLib(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id || !confirmed(formData)) return;
  await withTenant(tenantId, (tx) => tx.emailTemplate.delete({ where: { id } }));
  revalidatePath("/dashboard/emails");
  revalidatePath("/dashboard/templates");
  redirect("/dashboard/templates?tab=emails");
}

/**
 * Send the form's *current* subject/body to the signed-in user, rendered
 * against sample data — so a template can be checked before it's saved, or
 * before it's ever been attached to a real transaction. `renderMerge`
 * leaves unknown codes blank, same as a real send, so a typo in a merge
 * code shows up here rather than in front of a client.
 */
export async function testSendEmailTemplate(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const subject = str(formData, "subject");
  const body = str(formData, "body");
  if (!subject || !body) return;
  const { emailEnabled, sendTenantEmail } = await import("@/lib/email");
  if (!emailEnabled()) return;
  const { renderMerge } = await import("@/lib/email-template");
  const { sampleMergeContext, tenantName: getTenantName } = await import("@/lib/template-merge");
  const name = await getTenantName(tenantId);
  const merge = sampleMergeContext(name);
  await sendTenantEmail({
    tenantId,
    to: session.user.email,
    subject: `[Test] ${renderMerge(subject, merge)}`,
    body: renderMerge(body, merge),
  });
}

type EmailSettingsValue = string | number | boolean;

/** Merge a patch into organization.emailSettings without clobbering other keys. */
async function mergeEmailSettings(tenantId: string, patch: Record<string, EmailSettingsValue>) {
  const { prisma } = await import("@freehold/db");
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { emailSettings: true },
  });
  const current = (org.emailSettings as Record<string, EmailSettingsValue> | null) ?? {};
  await prisma.organization.update({
    where: { id: tenantId },
    data: { emailSettings: { ...current, ...patch } },
  });
}

/** Workspace signature + global footer, applied to every outgoing email. */
export async function saveEmailSettings(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const ccRaw = String(formData.get("cc") ?? "")
    .trim()
    .toLowerCase();
  await mergeEmailSettings(tenantId, {
    signature: String(formData.get("signature") ?? "").trim(),
    footer: String(formData.get("footer") ?? "").trim(),
    // Only persist a plausible address; a blank clears it.
    cc: ccRaw === "" || ccRaw.includes("@") ? ccRaw : "",
    quietStart: Number(formData.get("quietStart") ?? 20),
    quietEnd: Number(formData.get("quietEnd") ?? 8),
    timeZone: String(formData.get("timeZone") ?? "America/Chicago").trim(),
  });
  revalidatePath("/dashboard/emails");
}

/** How long after close to wait before asking for a review. Its own action so it sits next to the review template, not the general signature/footer form. */
export async function saveReviewDelay(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const raw = Number(formData.get("reviewDelayDays"));
  await mergeEmailSettings(tenantId, {
    reviewDelayDays: Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 3,
  });
  revalidatePath("/dashboard/emails");
}

/** Toggle the daily briefing email (owner + admins get a morning summary + PDF). */
export async function setDailyBriefing(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  await mergeEmailSettings(tenantId, { dailyBriefing: str(formData, "enabled") === "1" });
  revalidatePath("/dashboard/settings");
}

/**
 * Who gets the outstanding-invoices report each morning; empty switches it
 * off. One chosen user, not a broadcast — it's a working list for whoever
 * chases the money.
 */
export async function setInvoiceReport(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  await mergeEmailSettings(tenantId, { invoiceReportUserId: str(formData, "userId") });
  revalidatePath("/dashboard/settings");
}
