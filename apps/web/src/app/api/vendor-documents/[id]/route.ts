import { prisma, withTenant } from "@freehold/db";
import { getObjectBytes } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Streams a vendor's shared profile document (insurance, W-9, E&O…) to a
 * coordinator. VendorDocument is a vendor-owned root table with no RLS, so the
 * gate is explicit: the requesting tenant must actually work with this vendor —
 * an ACTIVE connection or any order between them — and the document must be one
 * the vendor marked shareOnOrder. We resolve the capability first, then read
 * the bytes; the id in the URL is never trusted on its own.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId } = await requireTenant();
  const { id } = await params;

  const doc = await prisma.vendorDocument.findFirst({
    where: { id, shareOnOrder: true },
    select: {
      vendorId: true,
      filename: true,
      contentType: true,
      data: true,
      storageKey: true,
      storageProvider: true,
    },
  });
  if (!doc) return new Response("Not found", { status: 404 });

  // Does this tenant have any relationship with the document's vendor?
  const [connection, order] = await withTenant(tenantId, async (tx) => [
    await tx.vendorConnection.findFirst({
      where: { vendorId: doc.vendorId, status: "ACTIVE" },
      select: { id: true },
    }),
    await tx.vendorOrder.findFirst({
      where: { vendorId: doc.vendorId },
      select: { id: true },
    }),
  ]);
  if (!connection && !order) return new Response("Not found", { status: 404 });

  const bytes = await getObjectBytes({
    storageKey: doc.storageKey,
    data: doc.data,
    storageProvider: doc.storageProvider,
    tenantId: doc.vendorId,
  });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${(doc.filename ?? "document").replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
