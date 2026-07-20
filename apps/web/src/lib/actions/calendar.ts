"use server";

import { randomBytes } from "node:crypto";
import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";

/** Invalidate the old calendar link and mint a new one — the old URL 404s from then on. */
export async function regenerateCalendarToken() {
  const { tenantId, userId } = await requireTenant({ allowGuest: true });
  const member = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId },
    select: { id: true },
  });
  if (!member) return;
  await prisma.member.update({
    where: { id: member.id },
    data: { calendarToken: randomBytes(24).toString("base64url") },
  });
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/calendar");
}
