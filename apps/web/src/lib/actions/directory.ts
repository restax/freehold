"use server";

import { prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import {
  AVAILABILITY,
  canListWithCoverage,
  type DirectoryConfig,
  PRICING_MODELS,
  readDirectoryConfig,
  SOFTWARE,
  SPECIALIZATIONS,
} from "@/lib/directory";
import { intOr, optStr, str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * The workspace's directory listing, managed from /dashboard/directory —
 * the page it actually affects. Admin-only and audited: opting in publishes
 * the workspace's name, coverage, and contact address to other workspaces
 * and to the public syndication feed.
 */

/** The current blob plus this tenant's coverage count, in one round trip. */
async function loadListingState(tenantId: string) {
  const [org, stateCount] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { directoryConfig: true },
    }),
    withTenant(tenantId, (tx) => tx.tenantState.count()),
  ]);
  return { cfg: readDirectoryConfig(org.directoryConfig), stateCount };
}

/** Every write goes through here, so no field is ever dropped by accident. */
async function writeConfig(tenantId: string, next: DirectoryConfig) {
  await prisma.organization.update({
    where: { id: tenantId },
    data: { directoryConfig: next as object },
  });
  revalidatePath("/dashboard/directory");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

function listingError(message: string): never {
  redirect(`/dashboard/directory?listingError=${encodeURIComponent(message)}`);
}

/**
 * The one-click listed / not listed switch. Turning it on needs at least one
 * operating state — every directory search filters by state, so a listing
 * with no coverage is one nobody can find.
 */
export async function setDirectoryListed(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const listed = str(formData, "listed") === "on";

  const { cfg, stateCount } = await loadListingState(tenantId);
  if (listed && !canListWithCoverage(stateCount)) {
    listingError("Add at least one state you work in before listing your workspace.");
  }

  await writeConfig(tenantId, { ...cfg, listed });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "directory.listing_changed",
    summary: listed
      ? "Workspace listed in the coordinator directory"
      : "Workspace removed from the coordinator directory",
  });
}

/**
 * "Don't remind me." Only silences the nudge — it never lists or unlists,
 * and it's reversible from the same checkbox that set it.
 */
export async function setDirectoryReminders(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const { cfg } = await loadListingState(tenantId);
  await writeConfig(tenantId, { ...cfg, remindersOff: str(formData, "remindersOff") === "on" });
}

/**
 * The rest of the profile. Saving keeps whatever the switch and the reminder
 * checkbox already said — those are their own controls, not hidden fields
 * riding along with this form.
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

  const { cfg, stateCount } = await loadListingState(tenantId);
  // Coverage is what makes a profile findable, so it's required to save one
  // at all — not just to flip the switch. Saving a profile that could never
  // appear in a search is the confusing outcome worth refusing outright.
  if (!canListWithCoverage(stateCount)) {
    listingError("Add at least one state you work in before saving your listing.");
  }

  const years = intOr(formData, "yearsExperience");
  await writeConfig(tenantId, {
    ...cfg,
    blurb: optStr(formData, "blurb") ?? undefined,
    contactEmail: optStr(formData, "contactEmail") ?? undefined,
    specializations: pick("specializations", SPECIALIZATIONS),
    software: pick("software", SOFTWARE),
    availability: one("availability", AVAILABILITY),
    pricingModel: one("pricingModel", PRICING_MODELS),
    yearsExperience: years != null && years >= 0 && years <= 80 ? years : undefined,
    remote: formData.get("remote") === "on",
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "directory.listing_changed",
    summary: "Directory listing profile updated",
  });
}
