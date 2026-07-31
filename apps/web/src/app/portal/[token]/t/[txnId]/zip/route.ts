import { prisma, withTenant } from "@freehold/db";
import { buildDocumentZip, zipResponse } from "@/lib/zip";
import { zipFilename } from "@/lib/zip-names";

export const dynamic = "force-dynamic";

/** "Download all" for the agent portal: every agent-visible file, zipped. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; txnId: string }> },
) {
  const { token, txnId } = await params;
  const link = await prisma.portalLink.findUnique({ where: { token } });
  if (!link || link.revokedAt || link.audience !== "AGENT" || !link.clientId) {
    return new Response("Not found", { status: 404 });
  }
  const clientId = link.clientId;

  const txn = await withTenant(link.tenantId, (tx) =>
    tx.transaction.findFirst({
      where: { id: txnId, clientId },
      select: {
        propertyAddress: true,
        documents: {
          where: { visibleToAgent: true, isCurrent: true },
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
  if (!txn || txn.documents.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const archive = await buildDocumentZip(txn.documents);
  return zipResponse(archive, zipFilename(txn.propertyAddress));
}
