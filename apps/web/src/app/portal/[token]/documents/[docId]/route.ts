import { prisma, withTenant } from "@freehold/db";
import { getObjectBytes } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Public, token-scoped document download for portal viewers. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; docId: string }> },
) {
  const { token, docId } = await params;
  const link = await prisma.portalLink.findUnique({ where: { token } });
  if (!link || link.revokedAt) {
    return new Response("Not found", { status: 404 });
  }
  const isAgent = link.audience === "AGENT";
  if (!isAgent && !link.showDocuments) {
    return new Response("Not found", { status: 404 });
  }
  const doc = await withTenant(link.tenantId, (tx) =>
    tx.document.findUnique({
      where: { id: docId },
      select: {
        filename: true,
        contentType: true,
        data: true,
        storageKey: true,
        storageProvider: true,
        tenantId: true,
        transactionId: true,
        visibleToAgent: true,
        visibleToClient: true,
        transaction: { select: { clientId: true } },
      },
    }),
  );
  const inScope = isAgent
    ? doc?.transaction?.clientId === link.clientId && doc?.visibleToAgent
    : doc?.transactionId === link.transactionId && doc?.visibleToClient;
  if (!doc || !inScope) {
    return new Response("Not found", { status: 404 });
  }
  const bytes = await getObjectBytes(doc);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `inline; filename="${doc.filename.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
