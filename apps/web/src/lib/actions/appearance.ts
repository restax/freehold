"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import {
  type Appearance,
  FONTS,
  type HighlightScope,
  parseAppearance,
  THEMES,
} from "@/lib/appearance";
import { oneOf, str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";

const THEME_KEYS = Object.keys(THEMES) as (keyof typeof THEMES)[];
const FONT_KEYS = Object.keys(FONTS) as (keyof typeof FONTS)[];
const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = (fd: FormData, key: string, fallback: string) => {
  const v = str(fd, key);
  return HEX.test(v) ? v : fallback;
};

export async function saveAppearance(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;

  // Start from the stored config so a partial form never wipes other fields.
  const current = parseAppearance(
    (
      await prisma.organization.findUnique({
        where: { id: tenantId },
        select: { appearanceConfig: true },
      })
    )?.appearanceConfig,
  );

  const next: Appearance = {
    theme: oneOf(formData, "theme", THEME_KEYS, current.theme),
    portalFont: oneOf(formData, "portalFont", FONT_KEYS, current.portalFont),
    priorityColors: {
      HIGH: hex(formData, "priorityHigh", current.priorityColors.HIGH),
      CRITICAL: hex(formData, "priorityCritical", current.priorityColors.CRITICAL),
    },
    rowHighlight: {
      scope: oneOf(
        formData,
        "highlightScope",
        ["none", "critical", "high"] as HighlightScope[],
        current.rowHighlight.scope,
      ),
      color: hex(formData, "highlightColor", current.rowHighlight.color),
    },
  };

  await prisma.organization.update({
    where: { id: tenantId },
    data: { appearanceConfig: JSON.parse(JSON.stringify(next)) },
  });
  revalidatePath("/dashboard/settings/appearance");
}
