"use server";

import { prisma, VendorConnectionStatus, withTenant, withVendor } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { optStr, str } from "@/lib/forms";
import { adminAlert } from "@/lib/notify";
import { requireAdminTenant } from "@/lib/tenant";
import { requireVendor } from "@/lib/vendor-auth";
import { canAccept, canDecline } from "@/lib/vendor-connections";

/**
 * The connection handshake between a coordinator's workspace and a vendor.
 * Either side can request; the other accepts. Coordinator-side reads/writes go
 * through withTenant, vendor-side through withVendor — the RLS policy lets each
 * touch only its own rows. See lib/vendor-connections.ts for the state machine.
 */

// ---- Coordinator side --------------------------------------------------------

/** A coordinator asks a listed vendor to connect. */
export async function requestConnection(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const vendorId = str(formData, "vendorId");
  if (!vendorId) return;

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { name: true, listed: true },
  });
  if (!vendor) return;

  // Upsert-ish: re-requesting after a decline/revoke reopens rather than
  // tripping the unique constraint.
  const existing = await withTenant(tenantId, (tx) =>
    tx.vendorConnection.findUnique({
      where: { tenantId_vendorId: { tenantId, vendorId } },
      select: { id: true, status: true },
    }),
  );
  if (existing?.status === "ACTIVE" || existing?.status === "REQUESTED") return;

  await withTenant(tenantId, (tx) =>
    existing
      ? tx.vendorConnection.update({
          where: { id: existing.id },
          data: {
            status: VendorConnectionStatus.REQUESTED,
            requestedBy: "TENANT",
            requestedById: session.user.id,
            note: optStr(formData, "note"),
            respondedAt: null,
            revokedAt: null,
          },
        })
      : tx.vendorConnection.create({
          data: {
            tenantId,
            vendorId,
            requestedBy: "TENANT",
            requestedById: session.user.id,
            note: optStr(formData, "note"),
          },
        }),
  );

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "vendor.connection_requested",
    summary: `Requested a connection with ${vendor.name}`,
  });
  adminAlert(`🔗 Connection requested: a workspace → vendor ${vendor.name}`);
  revalidatePath("/dashboard/vendors");
}

/** Coordinator accepts a request the vendor initiated. */
export async function tenantAcceptConnection(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  if (!id) return;

  const updated = await withTenant(tenantId, async (tx) => {
    const c = await tx.vendorConnection.findUnique({
      where: { id },
      select: { status: true, requestedBy: true, vendorId: true },
    });
    if (!c || !canAccept(c, "TENANT")) return null;
    await tx.vendorConnection.update({
      where: { id },
      data: { status: VendorConnectionStatus.ACTIVE, respondedAt: new Date() },
    });
    return c;
  });
  if (!updated) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "vendor.connection_accepted",
    summary: "Accepted a vendor's connection request",
  });
  revalidatePath("/dashboard/vendors");
}

/** Coordinator declines a vendor-initiated request, or revokes an active one. */
export async function tenantEndConnection(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  if (!id) return;

  const result = await withTenant(tenantId, async (tx) => {
    const c = await tx.vendorConnection.findUnique({
      where: { id },
      select: { status: true, requestedBy: true },
    });
    if (!c) return null;
    if (canDecline(c, "TENANT")) {
      await tx.vendorConnection.update({
        where: { id },
        data: { status: VendorConnectionStatus.DECLINED, respondedAt: new Date() },
      });
      return "declined";
    }
    if (c.status === "ACTIVE") {
      await tx.vendorConnection.update({
        where: { id },
        data: { status: VendorConnectionStatus.REVOKED, revokedAt: new Date() },
      });
      return "revoked";
    }
    return null;
  });
  if (!result) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: `vendor.connection_${result}`,
    summary: result === "declined" ? "Declined a vendor request" : "Ended a vendor connection",
  });
  revalidatePath("/dashboard/vendors");
}

// ---- Vendor side -------------------------------------------------------------

/** Vendor accepts a request a coordinator initiated. */
export async function vendorAcceptConnection(formData: FormData) {
  const { vendorId } = await requireVendor();
  const id = str(formData, "id");
  if (!id) return;

  const c = await withVendor(vendorId, async (tx) => {
    const row = await tx.vendorConnection.findUnique({
      where: { id },
      select: { status: true, requestedBy: true, tenantId: true, vendorId: true },
    });
    // RLS guarantees this row is ours, but check the id maps to our vendor too.
    if (!row || row.vendorId !== vendorId || !canAccept(row, "VENDOR")) return null;
    await tx.vendorConnection.update({
      where: { id },
      data: { status: VendorConnectionStatus.ACTIVE, respondedAt: new Date() },
    });
    return row;
  });
  if (!c) return;

  // The coordinator's workspace gets this in their own audit trail.
  logAudit({
    tenantId: c.tenantId,
    action: "vendor.connection_accepted",
    summary: "A vendor accepted the connection",
  });
  revalidatePath("/vendor/dashboard");
}

/** Vendor declines a coordinator's request, or leaves an active connection. */
export async function vendorEndConnection(formData: FormData) {
  const { vendorId } = await requireVendor();
  const id = str(formData, "id");
  if (!id) return;

  const result = await withVendor(vendorId, async (tx) => {
    const c = await tx.vendorConnection.findUnique({
      where: { id },
      select: { status: true, requestedBy: true, vendorId: true, tenantId: true },
    });
    if (!c || c.vendorId !== vendorId) return null;
    if (canDecline(c, "VENDOR")) {
      await tx.vendorConnection.update({
        where: { id },
        data: { status: VendorConnectionStatus.DECLINED, respondedAt: new Date() },
      });
      return { kind: "declined", tenantId: c.tenantId };
    }
    if (c.status === "ACTIVE") {
      await tx.vendorConnection.update({
        where: { id },
        data: { status: VendorConnectionStatus.REVOKED, revokedAt: new Date() },
      });
      return { kind: "revoked", tenantId: c.tenantId };
    }
    return null;
  });
  if (!result) return;

  logAudit({
    tenantId: result.tenantId,
    action: `vendor.connection_${result.kind}`,
    summary:
      result.kind === "declined" ? "A vendor declined the request" : "A vendor left the connection",
  });
  revalidatePath("/vendor/dashboard");
}
