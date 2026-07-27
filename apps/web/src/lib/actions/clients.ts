"use server";

import { ClientType, EsignProvider, Prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { confirmed, oneOf, optStr, str } from "@/lib/forms";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

const CLIENT_TYPES = Object.values(ClientType);
const ESIGN_PROVIDERS = Object.values(EsignProvider);

function esignFrom(formData: FormData): EsignProvider | null {
  const v = str(formData, "esignProvider") as EsignProvider;
  return ESIGN_PROVIDERS.includes(v) ? v : null;
}

/** {name?, email?, phone?} → JSON, or undefined when every field is blank. */
function contactJson(
  formData: FormData,
  keys: [name: string, email: string, phone: string],
): Record<string, string> | undefined {
  const name = optStr(formData, keys[0]);
  const email = optStr(formData, keys[1]);
  const phone = optStr(formData, keys[2]);
  if (!name && !email && !phone) return undefined;
  return { ...(name && { name }), ...(email && { email }), ...(phone && { phone }) };
}

export async function createClient(formData: FormData) {
  const { tenantId } = await requireTenant();
  const name = str(formData, "name");
  if (!name) return;
  const type = oneOf(formData, "type", CLIENT_TYPES, ClientType.AGENT);

  // The office's billing contact, or the agent's brokerage — only the fields
  // that match the type are read, so a stray hidden input can't cross-wire an
  // agent with a billing contact.
  const billingContact =
    type === ClientType.BROKERAGE || type === ClientType.TEAM
      ? contactJson(formData, ["billingName", "billingEmail", "billingPhone"])
      : undefined;
  const brokerageInfo =
    type === ClientType.AGENT
      ? (() => {
          const bName = optStr(formData, "brokerageName");
          const bPhone = optStr(formData, "brokeragePhone");
          const bAddress = optStr(formData, "brokerageAddress");
          if (!bName && !bPhone && !bAddress) return undefined;
          return {
            ...(bName && { name: bName }),
            ...(bPhone && { phone: bPhone }),
            ...(bAddress && { address: bAddress }),
          };
        })()
      : undefined;

  const client = await withTenant(tenantId, (tx) =>
    tx.client.create({
      data: {
        tenantId,
        name,
        type,
        email: optStr(formData, "email"),
        phone: optStr(formData, "phone"),
        address: optStr(formData, "address"),
        billingContact,
        brokerageInfo,
        esignProvider: esignFrom(formData),
      },
    }),
  );
  revalidatePath("/dashboard/clients");
  // Land on the new client's page — for offices that's where agents get added.
  redirect(`/dashboard/clients/${client.id}`);
}

/**
 * Reclassify a client — e.g. a contact entered as an individual agent turns
 * out to be a brokerage. Changing kind (office ↔ individual ↔ company)
 * clears whichever type-specific blob no longer applies, so a stale
 * brokerage reference doesn't linger invisibly on what's now an office.
 * Same-kind changes (BROKERAGE ↔ TEAM) keep the billing contact as-is.
 */
export async function updateClientType(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const type = oneOf(formData, "type", CLIENT_TYPES, ClientType.AGENT);
  if (!id) return;

  await withTenant(tenantId, async (tx) => {
    const existing = await tx.client.findUnique({ where: { id }, select: { type: true } });
    if (!existing || existing.type === type) return;
    const wasOffice = existing.type === ClientType.BROKERAGE || existing.type === ClientType.TEAM;
    const isOffice = type === ClientType.BROKERAGE || type === ClientType.TEAM;
    await tx.client.update({
      where: { id },
      data: {
        type,
        ...(wasOffice && !isOffice ? { billingContact: Prisma.DbNull } : {}),
        ...(existing.type === ClientType.AGENT && type !== ClientType.AGENT
          ? { brokerageInfo: Prisma.DbNull }
          : {}),
      },
    });
  });
  revalidatePath(`/dashboard/clients/${id}`);
  revalidatePath("/dashboard/clients");
}

/**
 * Edit the profile: name, contact points, address, and the type-specific
 * blob — billing contact for offices, brokerage reference for agents. Only
 * the blob that matches the client's stored type is written, and blanking
 * every field of a blob clears it.
 */
export async function updateClientProfile(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return;

  await withTenant(tenantId, async (tx) => {
    const existing = await tx.client.findUnique({ where: { id }, select: { type: true } });
    if (!existing) return;
    const isOffice = existing.type === ClientType.BROKERAGE || existing.type === ClientType.TEAM;
    const billingContact = isOffice
      ? (contactJson(formData, ["billingName", "billingEmail", "billingPhone"]) ?? Prisma.DbNull)
      : undefined;
    const brokerageInfo =
      existing.type === ClientType.AGENT
        ? (() => {
            const bName = optStr(formData, "brokerageName");
            const bPhone = optStr(formData, "brokeragePhone");
            const bAddress = optStr(formData, "brokerageAddress");
            if (!bName && !bPhone && !bAddress) return Prisma.DbNull;
            return {
              ...(bName && { name: bName }),
              ...(bPhone && { phone: bPhone }),
              ...(bAddress && { address: bAddress }),
            };
          })()
        : undefined;
    await tx.client.update({
      where: { id },
      data: {
        name,
        email: optStr(formData, "email"),
        phone: optStr(formData, "phone"),
        address: optStr(formData, "address"),
        billingContact,
        brokerageInfo,
      },
    });
  });
  revalidatePath(`/dashboard/clients/${id}`);
  revalidatePath("/dashboard/clients");
}

/**
 * Add an agent to an office by typing who they are — creates the Contact
 * (category Agent, company = the office) and attaches it in one step, so a
 * roster doesn't require a detour through the contacts page.
 */
export async function addClientAgentInline(formData: FormData) {
  const { tenantId } = await requireTenant();
  const clientId = str(formData, "clientId");
  const name = str(formData, "name");
  if (!clientId || !name) return;

  await withTenant(tenantId, async (tx) => {
    const client = await tx.client.findUnique({ where: { id: clientId }, select: { name: true } });
    if (!client) return;
    const contact = await tx.contact.create({
      data: {
        tenantId,
        name,
        email: optStr(formData, "email"),
        phone: optStr(formData, "phone"),
        category: "Agent",
        company: client.name,
      },
    });
    await tx.clientAgent.create({ data: { tenantId, clientId, contactId: contact.id } });
  });
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/contacts");
}

export async function updateClientEsign(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) =>
    tx.client.update({ where: { id }, data: { esignProvider: esignFrom(formData) } }),
  );
  revalidatePath("/dashboard/clients");
}

export async function deleteClient(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  const id = str(formData, "id");
  if (!id || !isAdmin || !confirmed(formData)) return;
  const gone = await withTenant(tenantId, (tx) =>
    tx.client.delete({ where: { id }, select: { name: true } }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "client.deleted",
    summary: `Deleted client "${gone.name}"`,
    subjectType: "client",
    subjectId: id,
  });
  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}

/** Notes the TC keeps about a client, shown on the client page. */
export async function addClientNote(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const clientId = str(formData, "clientId");
  const body = str(formData, "body");
  if (!clientId || !body) return;
  await withTenant(tenantId, (tx) =>
    tx.clientNote.create({ data: { tenantId, clientId, authorId: session.user.id, body } }),
  );
  revalidatePath(`/dashboard/clients/${clientId}`);
}

/** Attach an agent (contact) to a managed client. */
export async function addClientAgent(formData: FormData) {
  const { tenantId } = await requireTenant();
  const clientId = str(formData, "clientId");
  const contactId = str(formData, "contactId");
  if (!clientId || !contactId) return;
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.clientAgent.findFirst({ where: { clientId, contactId } });
    if (!existing) await tx.clientAgent.create({ data: { tenantId, clientId, contactId } });
  });
  revalidatePath(`/dashboard/clients/${clientId}`);
}

/**
 * Detach an agent from a client. Their portal links for this client are
 * deactivated (never deleted) so re-attaching restores everything.
 */
export async function removeClientAgent(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  const gone = await withTenant(tenantId, async (tx) => {
    const link = await tx.clientAgent.delete({
      where: { id },
      include: { contact: { select: { id: true, name: true } } },
    });
    await tx.portalLink.updateMany({
      where: { clientId: link.clientId, contactId: link.contactId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return link;
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "client.agent_removed",
    summary: `Removed agent "${gone.contact.name}" from client (portal access deactivated)`,
    subjectType: "client",
    subjectId: gone.clientId,
  });
  revalidatePath(`/dashboard/clients/${gone.clientId}`);
}

/** Per-client automated-email switches (intro, post-close). */
/**
 * Per-client staleness thresholds. A blank field clears that override and
 * falls back to the workspace default, so "leave it alone" and "set it to
 * something" stay distinguishable — clearing all three removes the config
 * entirely rather than freezing today's defaults into the row.
 */
export async function saveClientAlertConfig(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  const num = (key: string): number | undefined => {
    const raw = String(formData.get(key) ?? "").trim();
    if (raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.round(n) : undefined;
  };
  const cfg: Record<string, number> = {};
  for (const key of ["staleDays", "criticalWindowDays", "criticalStaleDays"]) {
    const v = num(key);
    if (v !== undefined) cfg[key] = v;
  }
  await withTenant(tenantId, (tx) =>
    tx.client.update({
      where: { id },
      data: { alertConfig: Object.keys(cfg).length > 0 ? cfg : Prisma.DbNull },
    }),
  );
  revalidatePath(`/dashboard/clients/${id}`);
  revalidatePath("/dashboard");
}

export async function saveClientEmailPrefs(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) =>
    tx.client.update({
      where: { id },
      data: {
        emailPrefs: {
          intro: formData.get("intro") === "on",
          postClose: formData.get("postClose") === "on",
        },
      },
    }),
  );
  revalidatePath(`/dashboard/clients/${id}`);
}
