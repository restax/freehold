import { prisma, withTenant } from "@freehold/db";
import JSZip from "jszip";
import { getObjectBytes } from "@/lib/storage";

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
          where: { visibleToAgent: true },
          select: { filename: true, data: true, storageKey: true },
        },
      },
    }),
  );
  if (!txn || txn.documents.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const zip = new JSZip();
  const used = new Set<string>();
  for (const doc of txn.documents) {
    const bytes = await getObjectBytes(doc);
    let name = doc.filename.replace(/[^\w.\- ]/g, "_");
    while (used.has(name)) name = `_${name}`;
    used.add(name);
    zip.file(name, bytes);
  }
  const archive = await zip.generateAsync({ type: "uint8array" });
  const zipName = `${txn.propertyAddress.replace(/[^\w\- ]/g, "_").slice(0, 60)}.zip`;

  return new Response(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
