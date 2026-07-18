"use server";

import { PartyRole, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { oneOf, str } from "@/lib/forms";
import { requireTenant } from "@/lib/tenant";

const ROLES = Object.values(PartyRole);

export async function addParty(formData: FormData) {
  const { tenantId } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const contactId = str(formData, "contactId");
  if (!transactionId || !contactId) return;
  const role = oneOf(formData, "role", ROLES, PartyRole.OTHER);
  await withTenant(tenantId, (tx) =>
    tx.transactionParty.upsert({
      where: {
        transactionId_contactId_role: { transactionId, contactId, role },
      },
      create: { tenantId, transactionId, contactId, role },
      update: {},
    }),
  );
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

export async function removeParty(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const transactionId = str(formData, "transactionId");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.transactionParty.delete({ where: { id } }));
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
