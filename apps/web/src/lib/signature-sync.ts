import { prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import { renderEmailHtml } from "@/lib/email-template";
import { readSignatureState, signAll, signerParties } from "@/lib/signature-tracking";
import { putObject } from "@/lib/storage";
import { parseAppearance, resolveEmailAccent } from "@/lib/theme";

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

/**
 * OpenSign is the only provider that hands back a fetchable signed copy —
 * Documenso/DocuSign don't (Stage 2 of the OpenSign work). Downloads the
 * bytes, stores them, and lands them as a new Document version pointing at
 * the envelope that produced it (`sourceEnvelopeId`), following the same
 * version/isCurrent/replacesId convention every other document replacement
 * already uses. Best-effort: a failure here still leaves the envelope marked
 * COMPLETED (signature-state bookkeeping happens separately in
 * markEnvelopeSignaturesComplete) — a missing signed copy is recoverable by
 * re-running the poll, but a document stuck showing unsigned is not.
 */
export async function writeBackSignedCopy(
  tenantId: string,
  transactionId: string,
  documentId: string,
  envelopeId: string,
  signedFileUrl: string,
): Promise<void> {
  const res = await fetch(signedFileUrl);
  if (!res.ok) throw new Error(`Fetching signed copy failed: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());

  await withTenant(tenantId, async (tx) => {
    const original = await tx.document.findUnique({
      where: { id: documentId },
      select: { filename: true, visibleToAgent: true, visibleToClient: true, version: true },
    });
    if (!original) return;

    const put = await putObject(tenantId, original.filename, bytes, "application/pdf");
    const signedCopy = await tx.document.create({
      data: {
        tenantId,
        transactionId,
        filename: original.filename,
        contentType: "application/pdf",
        sizeBytes: bytes.length,
        data: put.data,
        storageKey: put.storageKey,
        storageProvider: put.storageProvider,
        visibleToAgent: original.visibleToAgent,
        visibleToClient: original.visibleToClient,
        version: original.version + 1,
        isCurrent: true,
        replacesId: documentId,
        sourceEnvelopeId: envelopeId,
      },
    });
    await tx.document.update({ where: { id: documentId }, data: { isCurrent: false } });
    await tx.transactionAttachment.updateMany({
      where: { transactionId, documentId },
      data: { documentId: signedCopy.id },
    });
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/**
 * Email each signer their direct link, for providers whose `createEnvelope`
 * came back with `signerLinks` — today, only OpenSign. Documenso/DocuSign are
 * real hosted accounts that notify signers natively; adding a second email
 * on top would be a duplicate, not a fix, so this is never called for them.
 *
 * Best-effort per recipient: one bad address must not lose the others, and a
 * mail outage must not turn a successful send into an ERROR envelope — the
 * document is genuinely out for signature either way, just harder to find.
 */
export async function notifySignerLinks(
  tenantId: string,
  transactionId: string,
  documentTitle: string,
  signerLinks: Array<{ email: string; url: string }>,
): Promise<void> {
  if (!emailEnabled() || signerLinks.length === 0) return;
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { name: true, appearanceConfig: true },
  });
  if (!org) return;
  const accent = resolveEmailAccent(parseAppearance(org.appearanceConfig));

  for (const { email, url } of signerLinks) {
    const body = `You have a document to sign: **${documentTitle}**.\n\n[Open and sign it](${url})\n\nThis link is yours alone — please don't forward it.`;
    await sendTenantEmail({
      tenantId,
      transactionId,
      to: email,
      subject: `Please sign: ${documentTitle}`,
      body,
      html: renderEmailHtml({ tenantName: org.name, body, accent }),
    }).catch(() => {});
  }
}
