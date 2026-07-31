"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { type CloudPromptConfig, readCloudPromptConfig } from "@/lib/cloud-prompt";
import { str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * A workspace's answer to the self-host Freehold Cloud prompt. Admin-only:
 * it's a decision about the install, not a per-person preference.
 */
async function writeCloudPrompt(tenantId: string, next: CloudPromptConfig) {
  await prisma.organization.update({
    where: { id: tenantId },
    data: { cloudPromptConfig: next as object },
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

/** "Not now" — back in a month. */
export async function snoozeCloudPrompt() {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { cloudPromptConfig: true },
  });
  await writeCloudPrompt(tenantId, {
    ...readCloudPromptConfig(org.cloudPromptConfig),
    snoozedAt: new Date().toISOString(),
  });
}

/**
 * "Never" — and its undo. Kept as a checkbox rather than a one-way button
 * because someone who turned it off should be able to see that they did.
 */
export async function setCloudPromptOff(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { cloudPromptConfig: true },
  });
  await writeCloudPrompt(tenantId, {
    ...readCloudPromptConfig(org.cloudPromptConfig),
    off: str(formData, "off") === "on",
  });
}
