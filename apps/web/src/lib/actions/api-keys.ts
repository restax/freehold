"use server";

import { createHash, randomBytes } from "node:crypto";
import { prisma, withTenant } from "@freehold/db";
import { generateWebhookSecret } from "@freehold/integrations";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { confirmed, str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";
import { WEBHOOK_EVENTS } from "@/lib/webhook-emit";

const NEW_KEY_COOKIE = "freehold-new-api-key";

/** Read (and thereby consume on next set) the one-time plaintext key. */
export async function readNewApiKey(): Promise<string | null> {
  return (await cookies()).get(NEW_KEY_COOKIE)?.value ?? null;
}

export async function createApiKey(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const name = str(formData, "name") || "Unnamed key";
  const secret = `fh_live_${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(secret).digest("hex");
  await prisma.apiKey.create({
    data: { tenantId, name, prefix: secret.slice(0, 12), hash },
  });
  (await cookies()).set(NEW_KEY_COOKIE, secret, { path: "/dashboard/settings", maxAge: 300 });
  revalidatePath("/dashboard/settings");
}

export async function revokeApiKey(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  await prisma.apiKey.updateMany({
    where: { id, tenantId },
    data: { revokedAt: new Date() },
  });
  (await cookies()).delete(NEW_KEY_COOKIE);
  revalidatePath("/dashboard/settings");
}

export async function createWebhookEndpoint(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const url = str(formData, "url");
  if (!url.startsWith("http")) return;
  const events = WEBHOOK_EVENTS.filter((e) => formData.get(e) === "on");
  if (events.length === 0) return;
  await withTenant(tenantId, (tx) =>
    tx.webhookEndpoint.create({
      data: { tenantId, url, secret: generateWebhookSecret(), events },
    }),
  );
  revalidatePath("/dashboard/settings");
}

export async function deleteWebhookEndpoint(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  if (!confirmed(formData)) return;
  await withTenant(tenantId, (tx) => tx.webhookEndpoint.deleteMany({ where: { id } }));
  revalidatePath("/dashboard/settings");
}
