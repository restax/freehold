"use server";

import { Prisma, prisma, withTenant } from "@freehold/db";
import { encryptSecret, loadMasterKey } from "@freehold/vault";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { str } from "@/lib/forms";
import { fetchFubPeople, loadFubKey, parseFubConfig, verifyFubKey } from "@/lib/fub";
import { requireAdminTenant } from "@/lib/tenant";

/** Connect Follow Up Boss: the key is verified live before anything saves. */
export async function connectFub(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const apiKey = str(formData, "apiKey");
  if (!apiKey) return;

  const verified = await verifyFubKey(apiKey);
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: verified ? "fub.connected" : "fub.connect_failed",
    summary: verified
      ? "Connected Follow Up Boss"
      : "Follow Up Boss connection failed verification — nothing saved",
  });
  if (!verified) return;

  await prisma.organization.update({
    where: { id: tenantId },
    data: { fubConfig: { enc: { ...encryptSecret(apiKey, loadMasterKey()) } } },
  });
  revalidatePath("/dashboard/integrations");
}

export async function disconnectFub(_formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  await prisma.organization.update({
    where: { id: tenantId },
    data: { fubConfig: Prisma.DbNull },
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "fub.disconnected",
    summary: "Disconnected Follow Up Boss",
  });
  revalidatePath("/dashboard/integrations");
}

/**
 * Pull FUB people into contacts. Idempotent: matches on email (case
 * insensitive); people without an email are skipped so re-runs never
 * duplicate. Existing contacts are left untouched — FUB is not made the
 * source of truth over local edits.
 */
export async function importFubContacts(_formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const apiKey = await loadFubKey(tenantId);
  if (!apiKey) return;

  const people = await fetchFubPeople(apiKey);
  let created = 0;
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.contact.findMany({
      where: { email: { not: null } },
      select: { email: true },
    });
    const known = new Set(existing.map((c) => c.email?.toLowerCase()).filter(Boolean));
    for (const p of people) {
      const email = p.emails?.[0]?.value?.toLowerCase();
      if (!email || known.has(email)) continue;
      const name = p.name || [p.firstName, p.lastName].filter(Boolean).join(" ") || email;
      await tx.contact.create({
        data: {
          tenantId,
          name,
          firstName: p.firstName ?? null,
          lastName: p.lastName ?? null,
          email,
          phone: p.phones?.[0]?.value ?? null,
          category: "Follow Up Boss",
          categories: ["Follow Up Boss"],
        },
      });
      known.add(email);
      created++;
    }
  });

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { fubConfig: true },
  });
  const stored = parseFubConfig(org.fubConfig);
  if (stored) {
    await prisma.organization.update({
      where: { id: tenantId },
      data: {
        fubConfig: JSON.parse(
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
    action: "fub.imported",
    summary: `Imported ${created} new contact${created === 1 ? "" : "s"} from Follow Up Boss (${people.length} people scanned)`,
  });
  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard/contacts");
}
