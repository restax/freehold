"use server";

import { prisma, type TenantTx, withTenant } from "@freehold/db";
import { redirect } from "next/navigation";
import { linkUsable } from "@/lib/form-access";
import {
  type FormLayout,
  isFormKind,
  layoutFields,
  parseLayout,
  parseParty,
  submitterFrom,
  validateSubmission,
} from "@/lib/form-schema";
import { hashSource, sourceIp } from "@/lib/public-request";
import { putObject } from "@/lib/storage";

/**
 * Public form submission — the only unauthenticated write in the product
 * that accepts files, so the limits are deliberate and all enforced here
 * rather than in the browser:
 *
 *   * The form must exist, be published, and be marked showPublic. A draft
 *     or portal-only form is a 404 to the internet.
 *   * A honeypot field no human sees (the tenant-site lead form's trick).
 *   * Per-source rate limit over a salted IP hash — enough to stop a script,
 *     cheap enough to be one indexed count.
 *   * Files: capped in count, size, and type, and stored against the
 *     submission rather than as Documents, so nothing unreviewed reaches the
 *     workspace's document library.
 *   * Nothing becomes a Client or Transaction here. A submission is a
 *     submission until a person converts it.
 *
 * Two entry points share that core: an anonymous submission from the public
 * page, and an identified one opened from an emailed link. The identified
 * path skips the rate limit (the recipient already proved the address) and
 * stamps the submission with the client it belongs to.
 */

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 5000;
const RATE_LIMIT = 8;
const RATE_WINDOW_MINUTES = 15;

const ALLOWED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function clean(v: string): string {
  return v.trim().slice(0, MAX_TEXT_CHARS);
}

/**
 * Read answers strictly from the stored layout: a field the TC never put on
 * the form cannot be smuggled in by adding an input to the page.
 */
function readAnswers(layout: FormLayout, formData: FormData): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of layoutFields(layout)) {
    if (f.type === "file") continue;
    if (f.type === "party") {
      const party = parseParty({
        name: formData.get(`f_${f.key}.name`),
        email: formData.get(`f_${f.key}.email`),
        phone: formData.get(`f_${f.key}.phone`),
      });
      if (party) values[f.key] = party;
      continue;
    }
    if (f.type === "checkbox") {
      values[f.key] = formData.get(`f_${f.key}`) === "on";
      continue;
    }
    const raw = formData.get(`f_${f.key}`);
    if (typeof raw === "string" && raw.trim()) values[f.key] = clean(raw);
  }
  return values;
}

async function readUploads(layout: FormLayout, formData: FormData, tenantId: string) {
  const uploads: Array<{
    fieldKey: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    stored: Awaited<ReturnType<typeof putObject>>;
  }> = [];
  const fileFields = layoutFields(layout)
    .filter((f) => f.type === "file")
    .slice(0, MAX_FILES);
  for (const f of fileFields) {
    const file = formData.get(`f_${f.key}`);
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > MAX_FILE_BYTES) continue;
    const contentType = file.type || "application/octet-stream";
    if (!ALLOWED_UPLOAD_TYPES.has(contentType)) continue;
    const stored = await putObject(
      tenantId,
      file.name || "upload",
      Buffer.from(await file.arrayBuffer()),
      contentType,
    );
    uploads.push({
      fieldKey: f.key,
      filename: (file.name || "upload").slice(0, 200),
      contentType,
      sizeBytes: file.size,
      stored,
    });
  }
  return uploads;
}

async function persist(
  tx: TenantTx,
  args: {
    tenantId: string;
    form: { id: string; name: string; kind: string };
    layout: FormLayout;
    values: Record<string, unknown>;
    uploads: Awaited<ReturnType<typeof readUploads>>;
    clientId: string | null;
    submitterEmailOverride: string | null;
    ipHash: string | null;
  },
) {
  const who = submitterFrom(args.values);
  const submission = await tx.formSubmission.create({
    data: {
      tenantId: args.tenantId,
      formId: args.form.id,
      formName: args.form.name,
      formKind: args.form.kind,
      // The layout as filled — editing the form later can't change what
      // this submission meant.
      schemaSnapshot: args.layout as never,
      data: args.values as never,
      submitterName: who.name,
      submitterEmail: args.submitterEmailOverride ?? who.email,
      submitterPhone: who.phone,
      clientId: args.clientId,
      ipHash: args.ipHash,
      status: "new",
    },
  });
  for (const u of args.uploads) {
    await tx.formSubmissionFile.create({
      data: {
        tenantId: args.tenantId,
        submissionId: submission.id,
        fieldKey: u.fieldKey,
        filename: u.filename,
        contentType: u.contentType,
        sizeBytes: u.sizeBytes,
        data: u.stored.data,
        storageKey: u.stored.storageKey,
        storageProvider: u.stored.storageProvider,
      },
    });
  }
  await tx.task.create({
    data: {
      tenantId: args.tenantId,
      title: `Review ${args.form.name.toLowerCase()}: ${
        who.name ?? args.submitterEmailOverride ?? who.email ?? "new submission"
      }`,
      dueDate: new Date(),
      priority: "HIGH",
    },
  });
  return submission;
}

/** Anonymous submission from a form's public page. */
export async function submitPublicForm(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const formSlug = String(formData.get("formSlug") ?? "");
  // Bots fill every field they find; people never see this one.
  if (String(formData.get("company_website") ?? "")) return;
  if (!orgSlug || !formSlug) return;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true },
  });
  if (!org) return;

  const form = await withTenant(org.id, (tx) => tx.form.findFirst({ where: { slug: formSlug } }));
  // Only a published, publicly-placed form is reachable from the internet.
  if (form?.status !== "published" || !form.showPublic || !isFormKind(form.kind)) return;

  const ipHash = hashSource(await sourceIp(), org.id);
  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000);
  const recent = await withTenant(org.id, (tx) =>
    tx.formSubmission.count({ where: { ipHash, createdAt: { gte: since } } }),
  );
  if (recent >= RATE_LIMIT) redirect(`/t/${orgSlug}/f/${formSlug}?tooMany=1`);

  const layout = parseLayout(form.layout);
  const values = readAnswers(layout, formData);
  const errors = validateSubmission(layout, values);
  if (Object.keys(errors).length > 0) {
    // Zero-JS: bounce back naming the offending field, rather than silently
    // dropping a form somebody just spent five minutes on.
    redirect(`/t/${orgSlug}/f/${formSlug}?invalid=${encodeURIComponent(Object.keys(errors)[0])}`);
  }

  const uploads = await readUploads(layout, formData, org.id);
  await withTenant(org.id, (tx) =>
    persist(tx, {
      tenantId: org.id,
      form,
      layout,
      values,
      uploads,
      clientId: null,
      submitterEmailOverride: null,
      ipHash,
    }),
  );
  redirect(`/t/${orgSlug}/f/${formSlug}?sent=1`);
}

/**
 * Submission from an emailed link. The token is the authorization — it
 * names the form and the client, so neither is taken from the request.
 */
export async function submitIdentifiedForm(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const orgSlug = String(formData.get("orgSlug") ?? "");
  if (!token || !orgSlug) return;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true },
  });
  if (!org) return;

  const link = await withTenant(org.id, (tx) =>
    tx.formAccessLink.findFirst({ where: { token }, include: { form: true } }),
  );
  if (!link || !linkUsable(link) || !isFormKind(link.form.kind)) return;

  const layout = parseLayout(link.form.layout);
  const values = readAnswers(layout, formData);
  const errors = validateSubmission(layout, values);
  if (Object.keys(errors).length > 0) {
    redirect(`/t/${orgSlug}/fl/${token}?invalid=${encodeURIComponent(Object.keys(errors)[0])}`);
  }

  const uploads = await readUploads(layout, formData, org.id);
  await withTenant(org.id, async (tx) => {
    await persist(tx, {
      tenantId: org.id,
      form: link.form,
      layout,
      values,
      uploads,
      // The token, not the form body, decides whose submission this is.
      clientId: link.clientId,
      submitterEmailOverride: link.email,
      ipHash: null,
    });
    await tx.formAccessLink.update({ where: { id: link.id }, data: { usedAt: new Date() } });
  });
  redirect(`/t/${orgSlug}/fl/${token}?sent=1`);
}
