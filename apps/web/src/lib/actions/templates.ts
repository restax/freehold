"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { optStr, str } from "@/lib/forms";
import { listTenants } from "@/lib/session";
import { putObject } from "@/lib/storage";
import { buildMergeContext, renderTemplatePdf, resolveTemplate } from "@/lib/templates";
import { requireTenant } from "@/lib/tenant";

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
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
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
      },
    }),
  );
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
