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
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/action-plans");
  revalidatePath("/dashboard/settings");
}
