"use server";

import { ClientType, EsignProvider, withTenant } from "@freehold/db";
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

export async function createClient(formData: FormData) {
  const { tenantId } = await requireTenant();
  const name = str(formData, "name");
  if (!name) return;
  await withTenant(tenantId, (tx) =>
    tx.client.create({
      data: {
        tenantId,
        name,
        type: oneOf(formData, "type", CLIENT_TYPES, ClientType.AGENT),
        email: optStr(formData, "email"),
        phone: optStr(formData, "phone"),
        esignProvider: esignFrom(formData),
      },
    }),
  );
  revalidatePath("/dashboard/clients");
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
