import { prisma, withTenant } from "@freehold/db";
import { fmtDate } from "@/lib/format";
import { statementCsv, statementText } from "@/lib/pay";
import { renderTemplatePdf } from "@/lib/templates";
import { getMemberRole, requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * The itemized statement for one pay request — PDF by default, `?format=csv`
 * for importing into whatever actually pays people. Visible to the person who
 * requested it and to workspace admins.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId, userId } = await requireTenant();
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format");

  const request = await withTenant(tenantId, (tx) =>
    tx.paymentRequest.findUnique({
      where: { id },
      select: {
        userId: true,
        requestedAt: true,
        user: { select: { name: true } },
        items: { select: { address: true, feeCents: true }, orderBy: { createdAt: "asc" } },
      },
    }),
  );
  if (!request) return new Response("Not found", { status: 404 });

  if (request.userId !== userId) {
    const role = await getMemberRole(tenantId, userId);
    if (role !== "owner" && role !== "admin") return new Response("Not found", { status: 404 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  const workspace = org?.name ?? "Freehold";
  const who = request.user.name;
  const requestedOn = fmtDate(request.requestedAt);

  if (format === "csv") {
    return new Response(statementCsv(request.items, who), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payment-statement-${requestedOn}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const text = statementText(request.items, who, workspace, requestedOn);
  const pdf = await renderTemplatePdf(`${workspace} — Payment statement`, text);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="payment-statement-${requestedOn}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
