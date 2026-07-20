"use server";

import { prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { optStr, str } from "@/lib/forms";
import { gapForPending, gapMessage, licenseEnforcement } from "@/lib/licensing";
import { requireTenant } from "@/lib/tenant";

/**
 * Per-transaction user assignment — who in the workspace works this file.
 * Any member can assign (it's day-to-day coordination, like editing tasks);
 * every change is audited. Fees on assignments arrive in the pay stage.
 */

export async function assignUser(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const userId = str(formData, "userId");
  if (!transactionId || !userId) return;

  // Only workspace members can be assigned.
  const membership = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId },
    select: { user: { select: { name: true } } },
  });
  if (!membership) return;

  const address = await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUnique({
      where: { id: transactionId },
      select: { propertyAddress: true },
    });
    if (!txn) return null;
    await tx.transactionAssignee.upsert({
      where: { transactionId_userId: { transactionId, userId } },
      create: { tenantId, transactionId, userId, roleLabel: optStr(formData, "roleLabel") },
      // Re-assigning an assigned user just updates their role label.
      update: { roleLabel: optStr(formData, "roleLabel") },
    });
    return txn.propertyAddress;
  });
  if (address === null) return;

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "transaction.assigned",
    summary: `Assigned ${membership.user.name} to ${address}`,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard");
}

export async function unassignUser(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id) return;

  // Removing the last licensed person leaves the same gap as never assigning
  // one, so under "block" the removal is refused rather than silently
  // stranding the file.
  const enforcement = await licenseEnforcement(tenantId);

  const removed = await withTenant(tenantId, async (tx) => {
    const row = await tx.transactionAssignee.findUnique({
      where: { id },
      select: {
        userId: true,
        transactionId: true,
        user: { select: { name: true } },
        transaction: { select: { propertyAddress: true, state: true } },
      },
    });
    if (!row) return null;
    if (enforcement === "block") {
      const remaining = await tx.transactionAssignee.findMany({
        where: { transactionId: row.transactionId, id: { not: id } },
        select: { userId: true },
      });
      const gap = await gapForPending(
        tx,
        row.transaction.state,
        remaining.map((a) => a.userId),
      );
      if (gap) return { blocked: gapMessage(gap) } as const;
    }
    await tx.transactionAssignee.delete({ where: { id } });
    return row;
  });
  if (!removed) return;
  if ("blocked" in removed) {
    redirect(
      `/dashboard/transactions/${transactionId}?tab=participants&licenseError=${encodeURIComponent(removed.blocked)}`,
    );
  }

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "transaction.unassigned",
    summary: `Unassigned ${removed.user.name} from ${removed.transaction.propertyAddress}`,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard");
}
