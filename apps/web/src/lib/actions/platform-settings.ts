"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { optStr, str } from "@/lib/forms";
import { isOperator } from "@/lib/operator";

/** Operator edits the global platform settings — the founder-call kill switch,
 *  cooldown, and the homepage voice demo's selling points. */
export async function updatePlatformSettings(formData: FormData) {
  if (!(await isOperator())) return;

  const cooldownRaw = str(formData, "founderCallCooldownMinutes");
  const cooldown = Number.parseInt(cooldownRaw, 10);

  await prisma.platformSetting.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      founderCallsAvailable: formData.get("founderCallsAvailable") === "on",
      founderCallCooldownMinutes: Number.isFinite(cooldown) && cooldown > 0 ? cooldown : 15,
      founderCallSellingPoints: optStr(formData, "founderCallSellingPoints"),
    },
    update: {
      founderCallsAvailable: formData.get("founderCallsAvailable") === "on",
      ...(Number.isFinite(cooldown) && cooldown > 0
        ? { founderCallCooldownMinutes: cooldown }
        : {}),
      founderCallSellingPoints: optStr(formData, "founderCallSellingPoints"),
    },
  });

  revalidatePath("/admin/settings");
}
