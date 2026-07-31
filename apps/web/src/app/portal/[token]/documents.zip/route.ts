import { prisma, withTenant } from "@freehold/db";
import { buildDocumentZip, zipResponse } from "@/lib/zip";
import { zipFilename } from "@/lib/zip-names";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * "Download all" for a client's portal link: every file that link is allowed
 * to show, in one archive. The agent portal has had this since it shipped;
 * a buyer asked for their closing package the same way.
 *
 * Scope comes from the token, never the request — the link decides whether
 * documents are shared at all (showDocuments) and which transaction they
 * belong to.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.portalLink.findUnique({ where: { token } });
  if (!link || link.revokedAt || link.audience !== "CLIENT" || !link.showDocuments) {
    return new Response("Not found", { status: 404 });
  }
  const transactionId = link.transactionId;
  if (!transactionId) return new Response("Not found", { status: 404 });

  const txn = await withTenant(link.tenantId, (tx) =>
    tx.transaction.findUnique({
      where: { id: transactionId },
      select: {
        propertyAddress: true,
        documents: {
          where: { visibleToClient: true, isCurrent: true },
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
  if (!txn || txn.documents.length === 0) return new Response("Not found", { status: 404 });

  const archive = await buildDocumentZip(txn.documents);
  return zipResponse(archive, zipFilename(txn.propertyAddress));
}
