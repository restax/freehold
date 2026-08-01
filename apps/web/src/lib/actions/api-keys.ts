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

const NEW_SKILL_KEY_COOKIE = "freehold-new-skill-key";

/** One-time plaintext key for the Claude Skill card on the Integrations page. */
export async function readNewSkillKey(): Promise<string | null> {
  return (await cookies()).get(NEW_SKILL_KEY_COOKIE)?.value ?? null;
}

/**
 * One-click skill setup from the Integrations page: same hashed-key
 * mechanics as createApiKey, but named for what it is and surfaced back on
 * the Integrations card (once, via short-lived cookie) inside a paste-ready
 * Claude prompt.
 *
 * Gated on the same workspace switch as the connector. The switch means "this
 * workspace allows an AI assistant to reach its data", and minting a key whose
 * whole purpose is to be pasted into a chat is exactly that — so an owner who
 * has said no must not be able to be overridden by an admin one card down.
 *
 * Checked here and not only in the UI: hiding a button is a presentation
 * choice, and a server action is reachable by anyone who can post to it.
 */
export async function createSkillKey(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { mcpEnabled: true },
  });
  if (!org?.mcpEnabled) return;
  str(formData, "noop"); // plain form post, no payload
  const secret = `fh_live_${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(secret).digest("hex");
  await prisma.apiKey.create({
    data: { tenantId, name: "Claude Skill", prefix: secret.slice(0, 12), hash },
  });
  (await cookies()).set(NEW_SKILL_KEY_COOKIE, secret, {
    path: "/dashboard/integrations",
    maxAge: 300,
  });
  revalidatePath("/dashboard/integrations");
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
