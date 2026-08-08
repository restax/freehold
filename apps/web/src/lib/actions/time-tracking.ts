"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * The "time on files" workspace switch.
 *
 * Turning it off stops recording (the ping route no-ops) and hides the
 * dashboard panels; rows already recorded are kept, same policy as the
 * Handbook — a settings toggle is not a reasonable way to destroy a
 * workspace's history, and turning it back on picks up where it left off.
 */
export async function setTimeTrackingEnabled(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const on = str(formData, "on") === "1";

  await prisma.organization.update({
    where: { id: tenantId },
    data: { timeTrackingEnabled: on },
  });

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: on ? "time_tracking.enabled" : "time_tracking.disabled",
    summary: on ? "Turned time on files on" : "Turned time on files off",
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}
