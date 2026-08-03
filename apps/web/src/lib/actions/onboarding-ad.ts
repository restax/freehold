"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";

/** Dismiss for the onboarding ad widget — on the signed-in user, not the membership. */
export async function dismissOnboardingAd() {
  const { userId } = await requireTenant();
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingAdDismissedAt: new Date() },
  });
  revalidatePath("/dashboard");
}
