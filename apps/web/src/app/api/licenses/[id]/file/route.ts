import { withTenant } from "@freehold/db";
import { getObjectBytes } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Streams an uploaded license document (tenant-scoped via RLS). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId } = await requireTenant();
  const { id } = await params;
  const license = await withTenant(tenantId, (tx) =>
    tx.userLicense.findUnique({
      where: { id },
      select: {
        filename: true,
        contentType: true,
        data: true,
        storageKey: true,
        storageProvider: true,
        tenantId: true,
      },
    }),
  );
  if (!license?.contentType || (!license.data && !license.storageKey)) {
    return new Response("Not found", { status: 404 });
  }
  const bytes = await getObjectBytes(license);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": license.contentType,
      "Content-Disposition": `inline; filename="${(license.filename ?? "license").replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
