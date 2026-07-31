"use server";

import { prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { str } from "@/lib/forms";
import { normalizeState } from "@/lib/licenses";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * The states a workspace operates in, and which of them require a licensed
 * coordinator. Admin-only and audited: these rules decide whether files can be
 * saved at all under "block" enforcement. Freehold ships no built-in list of
 * which states require licensing — each business declares its own.
 */

export async function addState(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const state = normalizeState(str(formData, "state"));
  if (!state) return;
  const licenseRequired = formData.get("licenseRequired") === "on";

  await withTenant(tenantId, (tx) =>
    tx.tenantState.upsert({
      where: { tenantId_state: { tenantId, state } },
      create: { tenantId, state, licenseRequired },
      update: { licenseRequired },
    }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "states.changed",
    summary: `${state} ${licenseRequired ? "requires" : "does not require"} a licensed coordinator`,
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/transactions");
  // Coverage is what makes a directory listing findable, and the states can
  // now be edited from the directory page itself.
  revalidatePath("/dashboard/directory");
}

export async function removeState(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  if (!id) return;
  const removed = await withTenant(tenantId, async (tx) => {
    const row = await tx.tenantState.findUnique({ where: { id }, select: { state: true } });
    if (!row) return null;
    await tx.tenantState.delete({ where: { id } });
    return row;
  });
  if (!removed) return;
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "states.changed",
    summary: `Removed ${removed.state} from the workspace's operating states`,
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/directory");
}

/**
 * Warn (save and flag) or block (refuse the write) when a file in a
 * license-required state has nobody licensed assigned.
 */
export async function setLicenseEnforcement(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const mode = str(formData, "licenseEnforcement");
  if (mode !== "warn" && mode !== "block") return;
  await prisma.organization.update({
    where: { id: tenantId },
    data: { licenseEnforcement: mode },
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "states.enforcement_changed",
    summary:
      mode === "block"
        ? "License requirements now BLOCK saving a file with nobody licensed"
        : "License requirements now warn only",
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/transactions");
}
