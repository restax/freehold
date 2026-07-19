"use server";

import { Prisma, prisma } from "@freehold/db";
import { encryptSecret, loadMasterKey } from "@freehold/vault";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { optStr, str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * Connect a workspace to Documenso. The token is verified against the
 * instance before anything is saved (a bad URL or token never sticks), then
 * stored encrypted with VAULT_MASTER_KEY. Never echoed back to the UI.
 */
export async function connectDocumenso(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const url = str(formData, "url").replace(/\/$/, "");
  const token = str(formData, "token");
  if (!url || !token) return;

  let verified = false;
  try {
    const res = await fetch(`${url}/api/v2/document?page=1&perPage=1`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    verified = res.ok;
  } catch {
    verified = false;
  }
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: verified ? "esign.documenso_connected" : "esign.documenso_connect_failed",
    summary: verified
      ? `Connected Documenso at ${url}`
      : `Documenso connection to ${url} failed verification — nothing saved`,
  });
  if (!verified) return;

  await prisma.organization.update({
    where: { id: tenantId },
    data: { documensoConfig: { url, enc: { ...encryptSecret(token, loadMasterKey()) } } },
  });
  revalidatePath("/dashboard/integrations");
}

export async function disconnectDocumenso(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  // Deliberately unused beyond presence: plain form post, no payload needed.
  optStr(formData, "noop");
  await prisma.organization.update({
    where: { id: tenantId },
    data: { documensoConfig: Prisma.DbNull },
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "esign.documenso_disconnected",
    summary: "Disconnected Documenso for this workspace",
  });
  revalidatePath("/dashboard/integrations");
}
