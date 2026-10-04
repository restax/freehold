import { withTenant } from "@freehold/db";
import { isOperator } from "@/lib/operator";
import { getObjectBytes } from "@/lib/storage";
import { cleanFilename } from "@/lib/support-attachments";
import { getMemberRole, requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Serves one ticket attachment. Two ways in:
 * - a workspace member: an owner/admin can open any file on their workspace's
 *   tickets, anyone else only files on tickets they filed (the same split the
 *   ticket list uses);
 * - an operator, who names the workspace with ?tenant= because the file lives
 *   in a workspace they are not a member of.
 * Either way the read goes through withTenant, so a guessed id from another
 * workspace finds nothing.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantParam = new URL(req.url).searchParams.get("tenant");

  let tenantId: string;
  let onlyUserId: string | null = null;
  if (tenantParam && (await isOperator())) {
    tenantId = tenantParam;
  } else {
    const t = await requireTenant({ allowGuest: true });
    tenantId = t.tenantId;
    const role = await getMemberRole(t.tenantId, t.userId);
    if (role !== "owner" && role !== "admin") onlyUserId = t.userId;
  }

  const att = await withTenant(tenantId, (tx) =>
    tx.supportAttachment.findUnique({
      where: { id },
      select: {
        filename: true,
        contentType: true,
        data: true,
        storageKey: true,
        storageProvider: true,
        tenantId: true,
        ticket: { select: { userId: true } },
      },
    }),
  );
  if (!att || (onlyUserId && att.ticket.userId !== onlyUserId)) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = await getObjectBytes(att);
  return new Response(new Uint8Array(bytes), {
    headers: {
      // The type was sniffed from the file's own bytes at upload.
      "Content-Type": att.contentType,
      "Content-Disposition": `inline; filename="${cleanFilename(att.filename)}"`,
      // Belt and braces for user-supplied files served from our own origin.
      // Images also get a sandbox; a PDF cannot, because Chrome will not
      // render one under a sandboxed policy (nosniff still applies).
      "X-Content-Type-Options": "nosniff",
      ...(att.contentType === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox" }),
      "Cache-Control": "private, no-store",
    },
  });
}
