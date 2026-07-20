import { buildWorkspaceExport } from "@/lib/export";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** On-demand full export of the caller's workspace — data + documents, zipped. */
export async function GET() {
  const { tenantId } = await requireTenant();
  const result = await buildWorkspaceExport(tenantId);
  return new Response(new Uint8Array(result.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
