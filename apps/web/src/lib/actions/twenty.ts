"use server";

import { Prisma, prisma, withTenant } from "@freehold/db";
import { encryptSecret, loadMasterKey } from "@freehold/vault";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { str } from "@/lib/forms";
import { requireAdminTenant } from "@/lib/tenant";
import {
  fetchTwentyPeople,
  loadTwentyConnection,
  parseTwentyConfig,
  verifyTwenty,
} from "@/lib/twenty";

/** Connect Twenty CRM: URL + API key, verified live before anything saves. */
export async function connectTwenty(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const url = str(formData, "url").replace(/\/$/, "");
  const apiKey = str(formData, "apiKey");
  if (!url.startsWith("http") || !apiKey) return;

  const verified = await verifyTwenty({ url, apiKey });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: verified ? "twenty.connected" : "twenty.connect_failed",
    summary: verified
      ? `Connected Twenty CRM at ${url}`
      : `Twenty CRM connection to ${url} failed verification — nothing saved`,
  });
  if (!verified) return;

  await prisma.organization.update({
    where: { id: tenantId },
    data: { twentyConfig: { url, enc: { ...encryptSecret(apiKey, loadMasterKey()) } } },
  });
  revalidatePath("/dashboard/integrations");
}

export async function disconnectTwenty(_formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  await prisma.organization.update({
    where: { id: tenantId },
    data: { twentyConfig: Prisma.DbNull },
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "twenty.disconnected",
    summary: "Disconnected Twenty CRM",
  });
  revalidatePath("/dashboard/integrations");
}

/**
 * Pull Twenty people into contacts. Same contract as the Follow Up Boss
 * import: email-matched, additive only, safe to re-run.
 */
export async function importTwentyContacts(_formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const conn = await loadTwentyConnection(tenantId);
  if (!conn) return;

  const people = await fetchTwentyPeople(conn);
  let created = 0;
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.contact.findMany({
      where: { email: { not: null } },
      select: { email: true },
    });
    const known = new Set(existing.map((c) => c.email?.toLowerCase()).filter(Boolean));
    for (const p of people) {
      const email = p.emails?.primaryEmail?.toLowerCase();
      if (!email || known.has(email)) continue;
      const name = [p.name?.firstName, p.name?.lastName].filter(Boolean).join(" ").trim() || email;
      await tx.contact.create({
        data: {
          tenantId,
          name,
          firstName: p.name?.firstName ?? null,
          lastName: p.name?.lastName ?? null,
          email,
          phone: p.phones?.primaryPhoneNumber ?? null,
          category: "Twenty CRM",
          categories: ["Twenty CRM"],
        },
      });
      known.add(email);
      created++;
    }
  });

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { twentyConfig: true },
  });
  const stored = parseTwentyConfig(org.twentyConfig);
  if (stored) {
    await prisma.organization.update({
      where: { id: tenantId },
      data: {
        twentyConfig: JSON.parse(
          JSON.stringify({
            ...stored,
            importedAt: new Date().toISOString(),
            importedCount: created,
          }),
        ),
      },
    });
  }
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "twenty.imported",
    summary: `Imported ${created} new contact${created === 1 ? "" : "s"} from Twenty CRM (${people.length} people scanned)`,
  });
  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard/contacts");
}
