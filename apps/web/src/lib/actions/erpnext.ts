"use server";

import { Prisma, prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { encodeErpnextConfig, verifyErpnext } from "@/lib/erpnext";
import { str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * Connecting the tenant's own ERPNext for client invoicing. Same shape as the
 * other connectors: credentials are envelope-encrypted, and nothing is saved
 * until a live authenticated call against their instance succeeds — a bad key
 * should fail here, not silently at the first invoice.
 */

export async function connectErpnext(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const url = str(formData, "url").replace(/\/$/, "");
  const apiKey = str(formData, "apiKey");
  const apiSecret = str(formData, "apiSecret");
  const itemCode = str(formData, "itemCode") || "TC Services";
  if (!url.startsWith("http") || !apiKey || !apiSecret) return;

  const conn = { url, apiKey, apiSecret, itemCode };
  const verified = await verifyErpnext(conn);
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: verified.ok ? "erpnext.connected" : "erpnext.connect_failed",
    summary: verified.ok
      ? `Connected ERPNext at ${url} (item "${itemCode}")`
      : `ERPNext connection to ${url} failed verification — nothing saved`,
  });
  if (!verified.ok) {
    // Bounce back with the instance's own complaint, saving nothing.
    redirect(
      `/dashboard/integrations?erpnextError=${encodeURIComponent(
        verified.error ?? "Verification failed.",
      )}`,
    );
  }

  await prisma.organization.update({
    where: { id: tenantId },
    data: { erpnextConfig: encodeErpnextConfig(conn) as object },
  });
  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard/invoices");
}

export async function disconnectErpnext(_formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  await prisma.organization.update({
    where: { id: tenantId },
    data: { erpnextConfig: Prisma.DbNull },
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "erpnext.disconnected",
    summary: "Disconnected ERPNext — new invoices stay in Freehold",
  });
  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard/invoices");
}
