"use server";

import { VaultAction, withTenant } from "@freehold/db";
import { decryptSecret, encryptSecret, loadMasterKey } from "@freehold/vault";
import { revalidatePath } from "next/cache";
import { optStr, str } from "@/lib/forms";
import { requireTenant } from "@/lib/tenant";

export async function createCredential(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  const system = str(formData, "system");
  const username = str(formData, "username");
  const secret = String(formData.get("secret") ?? "");
  if (!system || !username || !secret) return;

  const enc = encryptSecret(secret, loadMasterKey());
  await withTenant(tenantId, async (tx) => {
    const cred = await tx.vaultCredential.create({
      data: {
        tenantId,
        clientId: optStr(formData, "clientId"),
        system,
        username,
        url: optStr(formData, "url"),
        notes: optStr(formData, "notes"),
        ...enc,
      },
    });
    await tx.vaultAccessLog.create({
      data: {
        tenantId,
        credentialId: cred.id,
        userId,
        action: VaultAction.CREATED,
        detail: `${system} (${username})`,
      },
    });
  });
  revalidatePath("/dashboard/vault");
}

/**
 * Decrypt a credential for display. Called from a client component so the
 * secret renders in place without ever landing in a URL. Every reveal is
 * written to the audit log before the secret is returned.
 */
export async function revealCredential(
  credentialId: string,
): Promise<{ username: string; secret: string } | { error: string }> {
  const { tenantId, userId } = await requireTenant();
  try {
    return await withTenant(tenantId, async (tx) => {
      const cred = await tx.vaultCredential.findUniqueOrThrow({ where: { id: credentialId } });
      await tx.vaultAccessLog.create({
        data: {
          tenantId,
          credentialId: cred.id,
          userId,
          action: VaultAction.REVEALED,
          detail: `${cred.system} (${cred.username})`,
        },
      });
      const secret = decryptSecret(cred, loadMasterKey());
      return { username: cred.username, secret };
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Reveal failed." };
  } finally {
    revalidatePath("/dashboard/vault");
  }
}

export async function deleteCredential(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, async (tx) => {
    const cred = await tx.vaultCredential.delete({ where: { id } });
    await tx.vaultAccessLog.create({
      data: {
        tenantId,
        userId,
        action: VaultAction.DELETED,
        detail: `${cred.system} (${cred.username})`,
      },
    });
  });
  revalidatePath("/dashboard/vault");
}
