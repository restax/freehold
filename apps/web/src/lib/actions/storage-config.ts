"use server";

import { Prisma, prisma } from "@freehold/db";
import { encryptSecret, loadMasterKey } from "@freehold/vault";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { str } from "@/lib/forms";
import { verifyTenantStorage } from "@/lib/storage";
import { requireAdminTenant } from "@/lib/tenant";

const BASE = "/dashboard/integrations";

/**
 * Connect a workspace to its own S3-compatible bucket. Credentials are proven
 * with a real put/get/delete round-trip before anything is saved (bad keys or
 * a wrong endpoint never stick), then stored encrypted with VAULT_MASTER_KEY.
 * New documents route to this bucket from then on.
 */
export async function connectStorage(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const endpoint = str(formData, "endpoint").replace(/\/$/, "");
  const region = str(formData, "region") || "us-east-1";
  const bucket = str(formData, "bucket");
  const accessKey = str(formData, "accessKey");
  const secretKey = str(formData, "secretKey");
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    redirect(`${BASE}?storageError=${encodeURIComponent("All storage fields are required.")}`);
  }

  const result = await verifyTenantStorage({
    provider: "S3",
    endpoint,
    region,
    bucket,
    accessKey,
    secretKey,
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: result.ok ? "storage.connected" : "storage.connect_failed",
    summary: result.ok
      ? `Connected document storage to ${bucket} at ${endpoint}`
      : `Storage connection to ${bucket} failed verification — nothing saved`,
  });
  if (!result.ok) {
    const msg = `Couldn't reach that bucket: ${result.error ?? "verification failed"}`;
    redirect(`${BASE}?storageError=${encodeURIComponent(msg)}`);
  }

  const key = loadMasterKey();
  await prisma.organization.update({
    where: { id: tenantId },
    data: {
      storageConfig: {
        provider: "S3",
        endpoint,
        region,
        bucket,
        accessKeyEnc: { ...encryptSecret(accessKey, key) },
        secretKeyEnc: { ...encryptSecret(secretKey, key) },
      },
    },
  });
  revalidatePath(BASE);
  redirect(`${BASE}?storageOk=1`);
}

/**
 * Disconnect tenant storage. Documents already written to that bucket become
 * unreadable until it's reconnected (we hold no other copy or credentials) —
 * the UI warns before this runs. New documents fall back to the default.
 */
export async function disconnectStorage(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  void str(formData, "noop");
  await prisma.organization.update({
    where: { id: tenantId },
    data: { storageConfig: Prisma.DbNull },
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "storage.disconnected",
    summary: "Disconnected document storage for this workspace",
  });
  revalidatePath(BASE);
}
