import { withTenant } from "@freehold/db";
import { guestMaySeeTransaction, requireTenant } from "@/lib/tenant";
import { buildDocumentZip, zipResponse } from "@/lib/zip";
import { zipFilename } from "@/lib/zip-names";

export const dynamic = "force-dynamic";
// A file with twenty scanned pages of disclosures takes real time to pull
// back out of storage and decrypt one at a time.
export const maxDuration = 60;

/**
 * "Download all" for the coordinator: every current file on the transaction,
 * zipped. Lenders and clients ask for the whole file, and the alternative is
 * clicking each document in turn and hoping none was missed.
 *
 * Guests are allowed — they work the files they've been handed, and this is
 * the same set of documents the Attachments tab already shows them — but
 * only for those files, hence the same coverage check the upload path uses.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId, session } = await requireTenant({ allowGuest: true });
  const { id } = await params;
  if (!(await guestMaySeeTransaction(tenantId, session.user.id, id))) {
    return new Response("Not found", { status: 404 });
  }

  const txn = await withTenant(tenantId, (tx) =>
    tx.transaction.findUnique({
      where: { id },
      select: {
        propertyAddress: true,
        documents: {
          where: { isCurrent: true },
          orderBy: { createdAt: "asc" },
          select: {
            filename: true,
            data: true,
            storageKey: true,
            storageProvider: true,
            tenantId: true,
          },
        },
      },
    }),
  );
  if (!txn) return new Response("Not found", { status: 404 });
  if (txn.documents.length === 0) return new Response("No documents on this file", { status: 404 });

  const archive = await buildDocumentZip(txn.documents);
  return zipResponse(archive, zipFilename(txn.propertyAddress));
}
