"use server";

import { prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { dateOnly, optStr, str } from "@/lib/forms";
import { normalizeState } from "@/lib/licenses";
import { deleteObject, putObject } from "@/lib/storage";
import { getMemberRole, requireTenant } from "@/lib/tenant";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB, same cap as documents

/**
 * Users manage their own licenses; admins manage anyone's — the tenant keeps
 * the records for its people. Returns the target userId, or null when the
 * caller may not touch that user's licenses (or the target isn't a member).
 */
async function resolveTarget(
  tenantId: string,
  callerId: string,
  requestedUserId: string,
): Promise<string | null> {
  const target = requestedUserId || callerId;
  if (target !== callerId) {
    const role = await getMemberRole(tenantId, callerId);
    if (role !== "owner" && role !== "admin") return null;
  }
  const membership = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId: target },
    select: { id: true },
  });
  return membership ? target : null;
}

export async function addLicense(formData: FormData) {
  const { tenantId, userId, session } = await requireTenant();
  const target = await resolveTarget(tenantId, userId, str(formData, "userId"));
  const state = normalizeState(str(formData, "state"));
  if (!target || !state) return;

  // Optional uploaded copy of the license document.
  const file = formData.get("file");
  let stored: {
    filename: string;
    contentType: string;
    sizeBytes: number;
    data: Uint8Array<ArrayBuffer> | null;
    storageKey: string | null;
    storageProvider: string | null;
  } | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return;
    const bytes = Buffer.from(await file.arrayBuffer());
    const put = await putObject(
      tenantId,
      file.name || "license.pdf",
      bytes,
      file.type || "application/octet-stream",
    );
    stored = {
      filename: file.name || "license.pdf",
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      data: put.data,
      storageKey: put.storageKey,
      storageProvider: put.storageProvider,
    };
  }

  await withTenant(tenantId, (tx) =>
    tx.userLicense.create({
      data: {
        tenantId,
        userId: target,
        state,
        licenseNumber: optStr(formData, "licenseNumber"),
        label: optStr(formData, "label"),
        expiresAt: dateOnly(formData, "expiresAt"),
        ...(stored ?? {}),
      },
    }),
  );
  const who = await prisma.user.findUnique({ where: { id: target }, select: { email: true } });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "license.added",
    summary: `Added a ${state} license for ${who?.email ?? target}`,
  });
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/team");
}

export async function deleteLicense(formData: FormData) {
  const { tenantId, userId, session } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;

  const removed = await withTenant(tenantId, async (tx) => {
    const license = await tx.userLicense.findUnique({
      where: { id },
      select: {
        userId: true,
        state: true,
        storageKey: true,
        storageProvider: true,
        user: { select: { email: true } },
      },
    });
    if (!license) return null;
    // Same authority rule as adding: yourself, or admin for anyone.
    if (license.userId !== userId) {
      const role = await getMemberRole(tenantId, userId);
      if (role !== "owner" && role !== "admin") return null;
    }
    await tx.userLicense.delete({ where: { id } });
    return license;
  });
  if (!removed) return;

  await deleteObject({
    storageKey: removed.storageKey,
    data: null,
    storageProvider: removed.storageProvider,
    tenantId,
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "license.removed",
    summary: `Removed a ${removed.state} license for ${removed.user.email}`,
  });
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/team");
}
