import { NextResponse } from "next/server";
import { buildWorkspaceExport } from "@/lib/export";
import { platformStorageConfigured, presignPlatformExport } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * On-demand full export of the caller's workspace — data + documents, zipped.
 *
 * Vercel Functions cap response bodies at 4.5 MB, far below what a real
 * tenant's documents add up to. When a platform bucket is configured we
 * upload the ZIP there and redirect to a short-lived presigned URL, so the
 * browser downloads straight from object storage instead of through this
 * function. Without a platform bucket (self-host's zero-config default,
 * where there's no Vercel body cap to begin with) we fall back to returning
 * the bytes directly, as before.
 */
export async function GET() {
  const { tenantId } = await requireTenant();
  const result = await buildWorkspaceExport(tenantId);

  if (platformStorageConfigured()) {
    const url = await presignPlatformExport(
      tenantId,
      result.zip,
      result.filename,
      "application/zip",
    );
    if (url) return NextResponse.redirect(url);
  }

  return new Response(new Uint8Array(result.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
