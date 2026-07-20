"use server";

import { Prisma, VaultAction, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { optStr, str } from "@/lib/forms";
import { decodeSkyslopeConfig, encodeSkyslopeConfig, parseSkyslopeConfig } from "@/lib/skyslope";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * Custody of a client's SkySlope API credentials. These belong to the agent,
 * not to the workspace — they're the agent's own login to a third-party system
 * — so they're admin-only to set, encrypted at rest, never rendered in full,
 * and every reveal is written to the audit trail.
 *
 * Nothing here calls SkySlope. Storing a key and proving it works are separate
 * facts, and the second one waits for the partner credentials and the API
 * contract; a connect flow that claimed "verified" without a live call would
 * be lying to the person trusting it.
 */

export async function connectSkyslope(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const clientId = str(formData, "clientId");
  const accessKey = str(formData, "accessKey");
  const secret = str(formData, "secret");
  if (!clientId || !accessKey || !secret) return;

  const client = await withTenant(tenantId, (tx) =>
    tx.client.update({
      where: { id: clientId },
      data: {
        skyslopeConfig: encodeSkyslopeConfig({
          accessKey,
          secret,
          label: optStr(formData, "label") ?? undefined,
        }) as object,
      },
      select: { name: true },
    }),
  );

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "skyslope.credentials_stored",
    summary: `Stored SkySlope API credentials for ${client.name}`,
  });
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function disconnectSkyslope(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const clientId = str(formData, "clientId");
  if (!clientId) return;

  const client = await withTenant(tenantId, (tx) =>
    tx.client.update({
      where: { id: clientId },
      data: { skyslopeConfig: Prisma.DbNull },
      select: { name: true },
    }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "skyslope.credentials_removed",
    summary: `Removed SkySlope API credentials for ${client.name}`,
  });
  revalidatePath(`/dashboard/clients/${clientId}`);
}

/**
 * Show the stored key to an admin who needs it — for handing back to the
 * agent, or checking which key is on file. Audited the same way a vault
 * reveal is, because it is one: somebody else's live credential.
 */
export async function revealSkyslope(
  clientId: string,
): Promise<{ accessKey: string; secret: string } | { error: string }> {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return { error: "Only workspace admins can reveal credentials." };
  try {
    return await withTenant(tenantId, async (tx) => {
      const client = await tx.client.findUniqueOrThrow({
        where: { id: clientId },
        select: { name: true, skyslopeConfig: true },
      });
      const cfg = parseSkyslopeConfig(client.skyslopeConfig);
      if (!cfg) return { error: "No SkySlope credentials stored for this client." };

      // The vault's access log is the workspace's record of who looked at
      // what; a SkySlope key belongs in it as much as an MLS login does.
      await tx.vaultAccessLog.create({
        data: {
          tenantId,
          userId: session.user.id,
          action: VaultAction.REVEALED,
          detail: `SkySlope API credentials (${client.name})`,
        },
      });
      const creds = decodeSkyslopeConfig(cfg);
      return { accessKey: creds.accessKey, secret: creds.secret };
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Reveal failed." };
  } finally {
    revalidatePath(`/dashboard/clients/${clientId}`);
  }
}
