"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * The two workspace switches.
 *
 * Separate on purpose. Turning the Handbook off hides the whole feature for a
 * team that doesn't want it; turning only the summary off keeps the notes,
 * the pooled recap and the grades — none of which call a model — for someone
 * whose objection is to the AI rather than to writing things down.
 *
 * Switching the Handbook off leaves every note in place. It is a workspace's
 * accumulated knowledge, and a settings toggle is not a reasonable way to
 * destroy it; turning it back on restores exactly what was there.
 */
export async function setHandbookEnabled(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const on = str(formData, "on") === "1";

  await prisma.organization.update({
    where: { id: tenantId },
    data: {
      handbookEnabled: on,
      // Re-enabling the feature shouldn't silently resume writing AI
      // summaries for a team that turned those off separately, so this only
      // ever moves in the safe direction.
      ...(on ? {} : { handbookSummaryEnabled: false }),
    },
  });

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: on ? "handbook.enabled" : "handbook.disabled",
    summary: on ? "Turned the Handbook on" : "Turned the Handbook off",
    subjectType: "organization",
    subjectId: tenantId,
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

export async function setHandbookSummaryEnabled(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const on = str(formData, "on") === "1";

  await prisma.organization.update({
    where: { id: tenantId },
    // Can't switch the summary on while the Handbook itself is off — it would
    // be a setting with no visible effect.
    data: { handbookSummaryEnabled: on, ...(on ? { handbookEnabled: true } : {}) },
  });

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: on ? "handbook.summary_enabled" : "handbook.summary_disabled",
    summary: on ? "Turned the daily summary on" : "Turned the daily summary off",
    subjectType: "organization",
    subjectId: tenantId,
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}
