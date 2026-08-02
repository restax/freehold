import { prisma, withTenant } from "@freehold/db";
import { NextResponse } from "next/server";
import { getObjectBytes } from "@/lib/storage";

/**
 * A photograph on a workspace's public website.
 *
 * Unauthenticated by design — these sit on a public marketing page, and the
 * tenant uploaded them precisely so strangers would see them. Two things keep
 * that from being a hole:
 *
 * - The workspace is resolved from the slug in the path, and the row is read
 *   through withTenant(), so RLS still applies. An id from one workspace
 *   cannot be fetched under another's slug.
 * - SiteImage is its own table. Documents (contracts, client files) are not
 *   reachable from here at all, so no visibility flag has to be right for
 *   this route to be safe.
 *
 * The middleware matcher skips /api/, so this resolves the same on a tenant
 * subdomain as it does at the apex.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!org) return new NextResponse("Not found", { status: 404 });

  const image = await withTenant(org.id, (tx) =>
    tx.siteImage.findUnique({
      where: { id },
      select: {
        contentType: true,
        data: true,
        storageKey: true,
        storageProvider: true,
        tenantId: true,
      },
    }),
  );
  if (!image) return new NextResponse("Not found", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await getObjectBytes(image);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(bytes.length),
      // Immutable: a SiteImage's bytes never change — replacing a photo makes
      // a new row with a new id, so the URL changes with it.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
