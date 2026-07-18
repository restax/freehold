import { withTenant } from "@freehold/db";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Streams a stored document (tenant-scoped) for in-browser viewing. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId } = await requireTenant();
  const { id } = await params;
  const doc = await withTenant(tenantId, (tx) =>
    tx.document.findUnique({
      where: { id },
      select: { filename: true, contentType: true, data: true },
    }),
  );
  if (!doc) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `inline; filename="${doc.filename.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
