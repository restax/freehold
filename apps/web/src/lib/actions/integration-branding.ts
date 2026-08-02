"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { optStr } from "@/lib/forms";
import { INTEGRATION_CATALOG } from "@/lib/integration-catalog";
import { isOperator } from "@/lib/operator";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const LOGO_MAX_BYTES = 500_000;

/**
 * Operator-only: set the logo and/or link for one card on
 * /dashboard/integrations. Every workspace sees the same branding — this
 * isn't tenant data — so it's stored inline as a data URL on
 * IntegrationBranding, the same small-image-no-bucket pattern as a
 * workspace's own site logo (saveSiteConfig in actions/website.ts).
 */
export async function saveIntegrationBranding(formData: FormData) {
  if (!(await isOperator())) return;

  const key = optStr(formData, "key");
  if (!key || !INTEGRATION_CATALOG.some((c) => c.key === key)) return;

  const url = optStr(formData, "url") ?? null;

  let logo: string | null | undefined;
  if (formData.get("removeLogo") === "on") {
    logo = null;
  } else {
    const file = formData.get("logo");
    if (file instanceof File && file.size > 0) {
      if (!LOGO_TYPES.includes(file.type) || file.size > LOGO_MAX_BYTES) {
        // Silently ignored rather than erroring the whole form: the URL
        // field on the same submit should still save.
      } else {
        const buf = Buffer.from(await file.arrayBuffer());
        logo = `data:${file.type};base64,${buf.toString("base64")}`;
      }
    }
  }

  await prisma.integrationBranding.upsert({
    where: { key },
    create: { key, url, ...(logo !== undefined ? { logo } : {}) },
    update: { url, ...(logo !== undefined ? { logo } : {}) },
  });

  revalidatePath("/admin/integrations");
  revalidatePath("/dashboard/integrations");
}
