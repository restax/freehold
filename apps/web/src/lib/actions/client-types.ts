"use server";

import { prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { CLIENT_TYPE_GROUPS, type ClientTypeGroup, canDisableGroup } from "@/lib/client-types";
import { str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * The lines of work a workspace is in.
 *
 * Admin-only and audited: switching private lending on changes what a
 * transaction screen looks like, and switching a line off removes it from the
 * create form. Neither is a preference someone should be able to flip from a
 * member seat.
 */

const COLUMN: Record<
  ClientTypeGroup,
  "clientTypeAgentEnabled" | "clientTypeOfficeEnabled" | "privateLendingEnabled"
> = {
  agent: "clientTypeAgentEnabled",
  office: "clientTypeOfficeEnabled",
  privateLender: "privateLendingEnabled",
};

export async function setClientTypeEnabled(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const group = str(formData, "group") as ClientTypeGroup;
  const spec = CLIENT_TYPE_GROUPS.find((g) => g.key === group);
  if (!spec) return;
  const on = str(formData, "on") === "1";

  if (!on) {
    // Switching a line of work off must never orphan clients already filed
    // under it. The form hides the switch in that case; this is the half that
    // actually enforces it.
    const inUse = await withTenant(tenantId, (tx) =>
      // biome-ignore lint/suspicious/noExplicitAny: enum values come from CLIENT_TYPE_GROUPS
      tx.client.count({ where: { type: { in: spec.types as any } } }),
    );
    if (!canDisableGroup(inUse)) return;
  }

  await prisma.organization.update({
    where: { id: tenantId },
    data: { [COLUMN[group]]: on },
  });

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: on ? "client_types.enabled" : "client_types.disabled",
    summary: `${on ? "Turned on" : "Turned off"} “${spec.label}” as a client type`,
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/clients");
}
