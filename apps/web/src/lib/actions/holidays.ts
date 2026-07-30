"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { FEDERAL_HOLIDAYS } from "@/lib/date-calculators";
import { requireAdminTenant } from "@/lib/tenant";

const VALID_KEYS = new Set(FEDERAL_HOLIDAYS.map((h) => h.key));

/** Which federal holidays a date template's business-day math should skip
 *  for this workspace. All are on unless explicitly unchecked — the "US
 *  Default" from the plan, so an unconfigured workspace behaves as if every
 *  box were ticked without anyone having to visit this page first. */
export async function saveHolidaySchedule(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const enabled = formData
    .getAll("holiday")
    .map(String)
    .filter((k) => VALID_KEYS.has(k));
  await prisma.organization.update({
    where: { id: tenantId },
    data: { holidaySchedule: { enabled } },
  });
  revalidatePath("/dashboard/settings");
}
