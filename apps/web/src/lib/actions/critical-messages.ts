"use server";

import { prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";

/**
 * Close a critical message. Closing is the read action — there is no
 * separate "seen" state — so this is the only write the tenant-facing side
 * of the broadcast system ever makes.
 */
export async function dismissCriticalMessage(messageId: string) {
  // memberId is re-derived server-side, never trusted from the client, the
  // same rule the Handbook's own authority checks follow.
  const { tenantId, userId } = await requireTenant();
  const member = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId },
    select: { id: true },
  });
  if (!member) return;
  await withTenant(tenantId, (tx) =>
    tx.criticalMessageDismissal.upsert({
      where: { messageId_memberId: { messageId, memberId: member.id } },
      create: { tenantId, messageId, memberId: member.id },
      update: {},
    }),
  );
  revalidatePath("/dashboard");
}
