import { prisma, withTenant } from "@freehold/db";
import { invoiceLabel, invoiceText } from "@/lib/invoicing";
import { renderTemplatePdf } from "@/lib/templates";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** The invoice as a PDF — same rendering the emailed copy uses. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId } = await requireTenant();
  const { id } = await params;
  const invoice = await withTenant(tenantId, (tx) =>
    tx.invoice.findUnique({
      where: { id },
      include: {
        client: { select: { name: true } },
        transaction: { select: { propertyAddress: true } },
        lines: {
          orderBy: { sortOrder: "asc" },
          select: { description: true, amountCents: true },
        },
      },
    }),
  );
  if (!invoice) return new Response("Not found", { status: 404 });

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { name: true },
  });
  const pdf = await renderTemplatePdf(
    `${org.name} — ${invoiceLabel(invoice.number)}`,
    invoiceText({
      number: invoice.number,
      workspaceName: org.name,
      clientName: invoice.client?.name ?? null,
      description: invoice.description,
      amountCents: invoice.amountCents,
      paymentTerms: invoice.paymentTerms,
      dueDate: invoice.dueDate,
      issuedOn: invoice.createdAt,
      transactionAddress: invoice.transaction?.propertyAddress ?? null,
      lines: invoice.lines,
      isDraft: invoice.status === "DRAFT",
    }),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceLabel(invoice.number)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
