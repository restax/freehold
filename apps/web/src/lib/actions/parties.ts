"use server";

import { PartyRole, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { type ContractParty, matchPartyRole } from "@/lib/ai/contract-schema";
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

/**
 * Promote one entry from the contract-extraction landing list into a real
 * party. Both halves happen together: create the TransactionParty (same
 * upsert addParty uses — re-linking something already linked is a no-op, not
 * a duplicate), and drop the matching text entry out of the JSON list, so a
 * row that's now a real party doesn't also keep sitting in the "suggestions"
 * queue offering to be linked a second time.
 *
 * The extractor's roles are lowercase snake_case ("buyer_agent") and don't
 * share a type with PartyRole ("BUYER_AGENT") — matched here by casing them
 * up rather than by adding a second role vocabulary. A role the enum doesn't
 * recognize (there isn't one today, but extraction output isn't guaranteed
 * against the enum) falls back to OTHER rather than throwing.
 */
export async function linkExtractedParty(formData: FormData) {
  const { tenantId } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const role = str(formData, "role");
  const value = str(formData, "value");
  const contactId = str(formData, "contactId");
  if (!transactionId || !contactId) return;
  const partyRole = matchPartyRole(role, ROLES, PartyRole.OTHER);

  await withTenant(tenantId, async (tx) => {
    const contact = await tx.contact.findUnique({ where: { id: contactId }, select: { id: true } });
    if (!contact) return;
    await tx.transactionParty.upsert({
      where: {
        transactionId_contactId_role: { transactionId, contactId, role: partyRole },
      },
      create: { tenantId, transactionId, contactId, role: partyRole },
      update: {},
    });

    const txn = await tx.transaction.findUniqueOrThrow({
      where: { id: transactionId },
      select: { contractParties: true },
    });
    const remaining = ((txn.contractParties as ContractParty[] | null) ?? []).filter(
      (p) => !(p.role === role && p.value === value),
    );
    await tx.transaction.update({
      where: { id: transactionId },
      data: { contractParties: remaining as unknown as Record<string, string>[] },
    });
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
