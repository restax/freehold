"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { str } from "@/lib/forms";
import { deleteObject, putObject } from "@/lib/storage";
import { requireVendor } from "@/lib/vendor-auth";
import { normalizeCoverage } from "@/lib/vendor-profile";

/**
 * Coverage areas and shareable documents on a vendor's own profile. Both live
 * on vendor-owned root tables (no tenant, no RLS) — every write re-derives the
 * vendorId from the session via requireVendor and scopes the row to it, never
 * trusting an id from the request. A vendor can only ever touch their own rows.
 */

const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB — these are certs, not media
const MAX_COVERAGE_ROWS = 300; // a generous ceiling; nobody legitimately serves more

/** Add one coverage area (STATE / COUNTY / ZIP). Silently de-dupes. */
export async function addVendorCoverage(formData: FormData) {
  const { vendorId } = await requireVendor();
  const norm = normalizeCoverage(str(formData, "kind"), str(formData, "value"));
  if (!norm) return;

  const count = await prisma.vendorCoverage.count({ where: { vendorId } });
  if (count >= MAX_COVERAGE_ROWS) return;

  const dupe = await prisma.vendorCoverage.findFirst({
    where: { vendorId, kind: norm.kind, value: norm.value },
    select: { id: true },
  });
  if (!dupe) {
    await prisma.vendorCoverage.create({ data: { vendorId, kind: norm.kind, value: norm.value } });
  }
  revalidatePath("/vendor/profile");
}

/** Remove one coverage area by id — scoped to the caller's vendor. */
export async function removeVendorCoverage(formData: FormData) {
  const { vendorId } = await requireVendor();
  const id = str(formData, "id");
  if (id) await prisma.vendorCoverage.deleteMany({ where: { id, vendorId } });
  revalidatePath("/vendor/profile");
}

/**
 * Upload a profile document (insurance, E&O, W-9, resume, …). Bytes go through
 * the same envelope-encrypted putObject path as transaction documents; the
 * vendorId is the key prefix (a vendor has no tenant). `shareOnOrder` decides
 * whether it auto-attaches when a coordinator places an order.
 */
export async function uploadVendorDocument(formData: FormData) {
  const { vendorId } = await requireVendor();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_DOC_BYTES) return;

  const label = str(formData, "label").slice(0, 80) || file.name.slice(0, 80) || "Document";
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";
  const stored = await putObject(vendorId, file.name || label, bytes, contentType);

  await prisma.vendorDocument.create({
    data: {
      vendorId,
      label,
      filename: file.name || label,
      contentType,
      sizeBytes: file.size,
      data: stored.data,
      storageKey: stored.storageKey,
      storageProvider: stored.storageProvider,
      shareOnOrder: str(formData, "shareOnOrder") === "1",
    },
  });
  revalidatePath("/vendor/profile");
}

/** Flip whether a document auto-attaches to new orders. */
export async function setVendorDocumentShare(formData: FormData) {
  const { vendorId } = await requireVendor();
  const id = str(formData, "id");
  if (id) {
    await prisma.vendorDocument.updateMany({
      where: { id, vendorId },
      data: { shareOnOrder: str(formData, "shareOnOrder") === "1" },
    });
  }
  revalidatePath("/vendor/profile");
}

/** Delete a profile document — removes the stored bytes, then the row. */
export async function deleteVendorDocument(formData: FormData) {
  const { vendorId } = await requireVendor();
  const id = str(formData, "id");
  if (!id) return;
  const doc = await prisma.vendorDocument.findFirst({
    where: { id, vendorId },
    select: { storageKey: true, data: true, storageProvider: true },
  });
  if (!doc) return;
  await deleteObject({
    storageKey: doc.storageKey,
    data: doc.data,
    storageProvider: doc.storageProvider,
    tenantId: vendorId,
  });
  await prisma.vendorDocument.deleteMany({ where: { id, vendorId } });
  revalidatePath("/vendor/profile");
}
