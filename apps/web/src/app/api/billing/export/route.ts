import { withTenant } from "@freehold/db";
import { dollars, toCsv } from "@/lib/billing-reports";
import { fmtDate } from "@/lib/format";
import { invoiceLabel } from "@/lib/invoicing";
import { getBillingAccess, requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Accounting export: the invoice book and the payments ledger as CSV, shaped
 * for spreadsheet review and QuickBooks-style imports (one row per invoice
 * line; amounts in dollars). Freehold's books are the record — this is how
 * they leave the building.
 */
export async function GET(req: Request) {
  const { tenantId, userId } = await requireTenant();
  if (!(await getBillingAccess(tenantId, userId)).view) {
    return new Response("Billing access required", { status: 403 });
  }
  const type = new URL(req.url).searchParams.get("type") === "payments" ? "payments" : "invoices";

  const invoices = await withTenant(tenantId, (tx) =>
    tx.invoice.findMany({
      orderBy: { number: "asc" },
      include: {
        client: { select: { name: true } },
        transaction: { select: { propertyAddress: true } },
        lines: {
          orderBy: { sortOrder: "asc" },
          select: {
            kind: true,
            description: true,
            amountCents: true,
            transaction: { select: { propertyAddress: true } },
          },
        },
        payments: {
          orderBy: { receivedAt: "asc" },
          select: {
            amountCents: true,
            method: true,
            reference: true,
            note: true,
            source: true,
            receivedAt: true,
            recordedByName: true,
          },
        },
      },
    }),
  );

  let csv: string;
  if (type === "payments") {
    csv = toCsv(
      [
        "Date",
        "InvoiceNo",
        "Customer",
        "Amount",
        "Method",
        "Reference",
        "Note",
        "Source",
        "RecordedBy",
      ],
      invoices.flatMap((inv) =>
        inv.payments.map((p) => [
          fmtDate(p.receivedAt),
          invoiceLabel(inv.number),
          inv.client?.name ?? "",
          dollars(p.amountCents),
          p.method ?? "",
          p.reference ?? "",
          p.note ?? "",
          p.source,
          p.recordedByName ?? "",
        ]),
      ),
    );
  } else {
    csv = toCsv(
      [
        "InvoiceNo",
        "Status",
        "Customer",
        "InvoiceDate",
        "DueDate",
        "ItemDescription",
        "ItemKind",
        "ItemAmount",
        "InvoiceTotal",
        "PaidToDate",
        "Property",
      ],
      invoices.flatMap((inv) => {
        const paid = inv.payments.reduce((s, p) => s + p.amountCents, 0);
        return inv.lines.map((l) => [
          invoiceLabel(inv.number),
          inv.status,
          inv.client?.name ?? "",
          fmtDate(inv.createdAt),
          inv.dueDate ? fmtDate(inv.dueDate) : "",
          l.description,
          l.kind,
          dollars(l.amountCents),
          dollars(inv.amountCents),
          dollars(paid),
          l.transaction?.propertyAddress ?? inv.transaction?.propertyAddress ?? "",
        ]);
      }),
    );
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="freehold-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
