"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { oneOf, optStr, str } from "@/lib/forms";
import { isOperator } from "@/lib/operator";
import { STATE_REFERENCE_SEED, TC_LICENSE_GENERAL_RULE } from "@/lib/state-reference-data";

/**
 * Fills in any state missing from state_reference — never overwrites a row
 * that already exists, so edits made in /admin/states survive a re-seed.
 * Same "restore defaults, don't clobber" shape as the template library.
 */
export async function seedStateReferences() {
  if (!(await isOperator())) return;
  const existing = await prisma.stateReference.findMany({ select: { code: true } });
  const have = new Set(existing.map((s) => s.code));
  const missing = STATE_REFERENCE_SEED.filter((s) => !have.has(s.code));
  if (missing.length > 0) {
    await prisma.stateReference.createMany({ data: missing });
  }
  const setting = await prisma.platformSetting.findUnique({
    where: { id: "singleton" },
    select: { tcLicenseGeneralRule: true },
  });
  if (!setting?.tcLicenseGeneralRule) {
    await prisma.platformSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", tcLicenseGeneralRule: TC_LICENSE_GENERAL_RULE },
      update: { tcLicenseGeneralRule: TC_LICENSE_GENERAL_RULE },
    });
  }
  revalidatePath("/admin/states");
}

export async function updateStateReference(formData: FormData) {
  if (!(await isOperator())) return;
  const code = str(formData, "code").toUpperCase();
  if (!code) return;
  await prisma.stateReference.update({
    where: { code },
    data: {
      name: str(formData, "name"),
      closingModel: oneOf(
        formData,
        "closingModel",
        ["TITLE_ESCROW", "ATTORNEY", "PARTIAL_ATTORNEY"] as const,
        "TITLE_ESCROW",
      ),
      closingModelDetail: str(formData, "closingModelDetail"),
      dominantMls: str(formData, "dominantMls"),
      licenseSummary: str(formData, "licenseSummary"),
      jargon: str(formData, "jargon"),
      verified: formData.get("verified") === "on",
    },
  });
  revalidatePath("/admin/states");
  revalidatePath(`/admin/states/${code}`);
}

export async function setLicenseGeneralRule(formData: FormData) {
  if (!(await isOperator())) return;
  await prisma.platformSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", tcLicenseGeneralRule: optStr(formData, "rule") },
    update: { tcLicenseGeneralRule: optStr(formData, "rule") },
  });
  revalidatePath("/admin/states");
}
