"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { revokeNylasGrant } from "@/lib/nylas";
import { requireTenant } from "@/lib/tenant";

/**
 * Disconnect the signed-in user's mailbox.
 *
 * The local row goes regardless of what Nylas says — if the revoke call
 * fails, the alternative is a user who clicked Disconnect and still appears
 * connected, which is worse than a grant left dangling on Nylas's side (it
 * can no longer be reached from here, and expires on its own).
 */
export async function disconnectNylas() {
  const { userId } = await requireTenant({ allowGuest: true });
  const grant = await prisma.nylasGrant.findUnique({
    where: { userId },
    select: { grantId: true },
  });
  if (!grant) return;

  await revokeNylasGrant(grant.grantId).catch(() => {});
  await prisma.nylasGrant.deleteMany({ where: { userId } });
  revalidatePath("/dashboard/profile");
}
