"use server";

import { prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { seedTenantData } from "@/lib/seed-core";
import { requireTenant } from "@/lib/tenant";

/**
 * Seed removable demo data into a tenant. Called right after workspace
 * creation (onboarding checkbox); tenantId comes from the client, so
 * membership is verified before any write.
 */
export async function seedSampleData(tenantId: string) {
  const { userId } = await requireTenant();
  const membership = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId },
    select: { id: true },
  });
  if (!membership) return;

  await seedTenantData(tenantId, userId);
  await prisma.organization.update({ where: { id: tenantId }, data: { hasSampleData: true } });
}

export async function removeSampleData() {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    // Order matters only for clarity — cascades cover children either way.
    await tx.task.deleteMany({ where: { isSample: true } });
    await tx.transaction.deleteMany({ where: { isSample: true } });
    await tx.actionPlan.deleteMany({ where: { isSample: true } });
    await tx.docTemplate.deleteMany({ where: { isSample: true } });
    await tx.emailTemplate.deleteMany({ where: { isSample: true } });
    await tx.contact.deleteMany({ where: { isSample: true } });
    await tx.client.deleteMany({ where: { isSample: true } });
  });
  // Organization and Member aren't RLS-scoped the way the deletes above are,
  // so these sit outside withTenant, same as the revalidatePath calls below.
  await prisma.organization.update({ where: { id: tenantId }, data: { hasSampleData: false } });
  // The "Today at a glance" summary is cached per member on a pure 1-hour
  // clock (lib/handbook/summary-context.ts's isStale), with no dependency on
  // the underlying data — clearing this tenant-wide forces every member's
  // next dashboard load to regenerate it against the post-removal reality,
  // rather than repeating sample-data content for up to an hour.
  await prisma.member.updateMany({
    where: { organizationId: tenantId },
    data: { handbookSummaryAt: null },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/action-plans");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/import");
}
