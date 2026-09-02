"use server";

import { Prisma, prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";
import { encodeWaveConfig, resolveWaveConnection } from "@/lib/wave";

/**
 * Connecting the tenant's own Wave account for client invoicing. Same shape as
 * the other connectors: the token is envelope-encrypted, and nothing is saved
 * until a live authenticated call resolves both the business and the product
 * every invoice line bills — a wrong token or a missing product should fail
 * here, not silently at the first invoice.
 */

export async function connectWave(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const token = str(formData, "token");
  const businessName = str(formData, "businessName");
  const productName = str(formData, "productName") || "TC Services";
  if (!token) return;

  const resolved = await resolveWaveConnection({ token, businessName, productName });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: resolved.ok ? "wave.connected" : "wave.connect_failed",
    summary: resolved.ok
      ? `Connected Wave business "${resolved.conn.businessName}" (product "${resolved.conn.productName}")`
      : "Wave connection failed verification — nothing saved",
  });
  if (!resolved.ok) {
    // Bounce back with Wave's own complaint, saving nothing.
    redirect(`/dashboard/integrations?waveError=${encodeURIComponent(resolved.error)}`);
  }

  await prisma.organization.update({
    where: { id: tenantId },
    data: { waveConfig: encodeWaveConfig(resolved.conn) as object },
  });
  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard/invoices");
}

export async function disconnectWave(_formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  await prisma.organization.update({
    where: { id: tenantId },
    data: { waveConfig: Prisma.DbNull },
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "wave.disconnected",
    summary: "Disconnected Wave — new invoices stay in Freehold",
  });
  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard/invoices");
}
