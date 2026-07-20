"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import {
  AVAILABILITY,
  type DirectoryConfig,
  PRICING_MODELS,
  SOFTWARE,
  SPECIALIZATIONS,
} from "@/lib/directory";
import { intOr, optStr, str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * The workspace's directory listing. Admin-only and audited: opting in
 * publishes the workspace's name, coverage, and contact address to other
 * workspaces and to the public syndication feed.
 */
export async function saveDirectoryListing(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;

  const pick = (field: string, allowed: readonly string[]) =>
    formData
      .getAll(field)
      .map(String)
      .filter((v) => allowed.includes(v));
  const one = (field: string, allowed: readonly string[]) => {
    const v = str(formData, field);
    return allowed.includes(v) ? v : undefined;
  };

  const listed = formData.get("listed") === "on";
  const years = intOr(formData, "yearsExperience");
  const config: DirectoryConfig = {
    listed,
    blurb: optStr(formData, "blurb") ?? undefined,
    contactEmail: optStr(formData, "contactEmail") ?? undefined,
    specializations: pick("specializations", SPECIALIZATIONS),
    software: pick("software", SOFTWARE),
    availability: one("availability", AVAILABILITY),
    pricingModel: one("pricingModel", PRICING_MODELS),
    yearsExperience: years != null && years >= 0 && years <= 80 ? years : undefined,
    remote: formData.get("remote") === "on",
  };

  await prisma.organization.update({
    where: { id: tenantId },
    data: { directoryConfig: config as object },
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "directory.listing_changed",
    summary: listed
      ? "Workspace listed in the coordinator directory"
      : "Workspace removed from the coordinator directory",
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/directory");
}
