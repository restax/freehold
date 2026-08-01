import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { readSignatureState, signAll, signerParties } from "@/lib/signature-tracking";

/**
 * An e-signature envelope came back complete, so whatever it signed is signed.
 *
 * Deliberately **not** in lib/actions/attachments.ts. Everything exported from
 * a "use server" module is a server action the browser can invoke by id, and
 * this takes a tenantId as an argument — as an action it would let anyone
 * stamp signatures onto another workspace's rows. It lives here as a plain
 * server-side function that the esign paths call directly.
 *
 * Only touches rows that had opted into tracking: an untracked row shouldn't
 * silently sprout pills because a document happened to be e-signed. Rows that
 * are tracking get every signer marked and the row itself ticked, because a
 * completed envelope next to a row reading "0 of 3 signed" is the kind of
 * disagreement that makes people stop believing the column.
 */
export async function markEnvelopeSignaturesComplete(
  tenantId: string,
  transactionId: string,
  documentId: string,
): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    const rows = await tx.transactionAttachment.findMany({
      where: { transactionId, documentId },
      select: { id: true, signatureState: true },
    });
    if (rows.length === 0) return;
    const parties = await tx.transactionParty.findMany({
      where: { transactionId },
      select: { id: true, role: true, contact: { select: { name: true } } },
    });
    const signers = signerParties(parties);
    const now = new Date();
    for (const row of rows) {
      const state = readSignatureState(row.signatureState);
      if (!state) continue;
      await tx.transactionAttachment.update({
        where: { id: row.id },
        data: { signatureState: signAll(state, signers, now), completedAt: now },
      });
    }
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
