"use server";

import { ClientType, EsignProvider, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { oneOf, optStr, str } from "@/lib/forms";
import { requireTenant } from "@/lib/tenant";

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
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.client.delete({ where: { id } }));
  revalidatePath("/dashboard/clients");
}
