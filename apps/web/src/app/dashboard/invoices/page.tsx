import { withTenant } from "@freehold/db";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { createInvoice, invoicingAllowed, invoicingEnabled, voidInvoice } from "@/lib/actions/invoices";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btn, card, input, label, summaryLink, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, BadgeTone> = {
  SENT: "progress",
  PAID: "success",
  VOID: "neutral",
};

export default async function InvoicesPage() {
  const { tenantId } = await requireTenant();
  const [enabled, allowed] = await Promise.all([invoicingEnabled(), invoicingAllowed(tenantId)]);
  const { invoices, clients, transactions } = await withTenant(tenantId, async (tx) => ({
    invoices: await tx.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } } },
    }),
    clients: await tx.client.findMany({ orderBy: { name: "asc" } }),
    transactions: await tx.transaction.findMany({
      where: { status: { notIn: ["CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, propertyAddress: true },
      take: 100,
    }),
  }));
  const billableClients = clients.filter((c) => c.email);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Invoices</h1>
        <p className="text-sm text-stone-500">
          Bill your clients for coordination work. Each invoice gets a hosted payment page you can
          text or email; status updates automatically when it's paid.
        </p>
      </div>

      {!enabled && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Invoicing needs a Stripe account: set <code>STRIPE_SECRET_KEY</code> in <code>.env</code>.
        </p>
      )}
      {enabled && !allowed && (
        <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600">
          Client invoicing is available on paid plans.{" "}
          <Link href="/dashboard/billing" className="font-medium text-brand-700 underline">
            See plans
          </Link>
          .
        </p>
      )}

      {allowed && (
        <details className={card} open={invoices.length === 0}>
          <summary className={summaryLink}>New invoice</summary>
          <form action={createInvoice} className="mt-4 flex flex-wrap items-end gap-3">
            <label className={label}>
              Client *
              <select name="clientId" required className={input} defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {billableClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Amount (USD) *
              <input
                name="amount"
                inputMode="decimal"
                required
                placeholder="350.00"
                className={`${input} w-28`}
              />
            </label>
            <label className={`${label} min-w-64 flex-1`}>
              Description
              <input
                name="description"
                placeholder="Transaction coordination: 412 Maple Avenue"
                className={input}
              />
            </label>
            <label className={label}>
              Transaction
              <select name="transactionId" className={input} defaultValue="">
                <option value="">—</option>
                {transactions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.propertyAddress}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={btn}>
              Create &amp; get payment link
            </button>
          </form>
          {billableClients.length < clients.length && (
            <p className="mt-2 text-xs text-stone-400">
              Clients without an email address can't be invoiced; add one on the Clients page.
            </p>
          )}
        </details>
      )}

      <section className={card}>
        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            hint="Create one above and Freehold gives you a hosted Stripe payment page for your client, then tracks when it's paid."
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Client</th>
                <th className={th}>Description</th>
                <th className={th}>Amount</th>
                <th className={th}>Status</th>
                <th className={th}>Created</th>
                <th className={th}>Paid</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className={trHover}>
                  <td className={`${td} font-medium`}>{inv.client?.name ?? "—"}</td>
                  <td className={td}>{inv.description}</td>
                  <td className={td}>${(inv.amountCents / 100).toLocaleString("en-US")}</td>
                  <td className={td}>
                    <Badge tone={STATUS_TONE[inv.status] ?? "neutral"}>
                      {inv.status.toLowerCase()}
                    </Badge>
                  </td>
                  <td className={td}>{fmtDate(inv.createdAt)}</td>
                  <td className={td}>{inv.paidAt ? fmtDate(inv.paidAt) : "—"}</td>
                  <td className={td}>
                    <span className="flex items-center gap-3">
                      {inv.hostedUrl && inv.status === "SENT" && (
                        <a
                          href={inv.hostedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-brand-700 hover:text-brand-600"
                        >
                          payment page
                        </a>
                      )}
                      {inv.status === "SENT" && (
                        <form action={voidInvoice}>
                          <input type="hidden" name="id" value={inv.id} />
                          <button
                            type="submit"
                            className="text-xs text-stone-400 hover:text-red-600"
                          >
                            void
                          </button>
                        </form>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
