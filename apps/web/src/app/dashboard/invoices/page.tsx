import { withTenant } from "@freehold/db";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import {
  createInvoice,
  invoicingAllowed,
  invoicingEnabled,
  voidInvoice,
} from "@/lib/actions/invoices";
import { markPaymentRequestPaid } from "@/lib/actions/pay";
import { fmtDate } from "@/lib/format";
import { fmtCents } from "@/lib/pay";
import { getMemberRole, requireTenant } from "@/lib/tenant";
import { btn, btnGhost, card, input, label, summaryLink, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, BadgeTone> = {
  SENT: "progress",
  PAID: "success",
  VOID: "neutral",
};

export default async function InvoicesPage() {
  const { tenantId, userId } = await requireTenant();
  const [enabled, allowed, role] = await Promise.all([
    invoicingEnabled(),
    invoicingAllowed(tenantId),
    getMemberRole(tenantId, userId),
  ]);
  const isAdmin = role === "owner" || role === "admin";
  // Pay requests from workspace users — the other side of the money page.
  const payRequests = isAdmin
    ? await withTenant(tenantId, (tx) =>
        tx.paymentRequest.findMany({
          orderBy: [{ status: "asc" }, { requestedAt: "asc" }],
          include: {
            user: { select: { name: true, email: true } },
            items: { select: { address: true, feeCents: true, transactionId: true } },
          },
        }),
      )
    : [];
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

      {isAdmin && payRequests.length > 0 && (
        <section className={card}>
          <h2 className="mb-1 font-medium">Pay requests</h2>
          <p className="mb-3 text-sm text-stone-500">
            What your team has asked to be paid for the files they worked. Freehold tracks and
            itemizes it; pay however you already pay people, then mark it here.
          </p>
          <ul className="flex flex-col">
            {payRequests.map((r) => {
              const total = r.items.reduce((s, i) => s + i.feeCents, 0);
              return (
                <li key={r.id} className="border-b border-stone-100 py-3 last:border-0">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <Badge tone={r.status === "PAID" ? "success" : "progress"}>
                      {r.status === "PAID" ? "Paid" : "Awaiting payment"}
                    </Badge>
                    <span className="font-medium">{r.user.name}</span>
                    <span className="tabular-nums font-medium">{fmtCents(total)}</span>
                    <span className="text-xs text-stone-400">
                      requested {fmtDate(r.requestedAt)}
                      {r.paidAt ? ` · paid ${fmtDate(r.paidAt)}` : ""}
                      {r.paidNote ? ` (${r.paidNote})` : ""}
                    </span>
                    <a
                      href={`/api/pay-requests/${r.id}/statement`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand-600 hover:underline"
                    >
                      PDF
                    </a>
                    <a
                      href={`/api/pay-requests/${r.id}/statement?format=csv`}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      CSV
                    </a>
                  </div>
                  {r.note && <p className="mt-1 text-xs text-stone-500">“{r.note}”</p>}
                  <ul className="mt-1.5 flex flex-col gap-0.5 border-l-2 border-stone-200 pl-3">
                    {r.items.map((i) => (
                      <li
                        key={`${r.id}-${i.address}`}
                        className="flex gap-3 text-xs text-stone-500"
                      >
                        {i.transactionId ? (
                          <Link
                            href={`/dashboard/transactions/${i.transactionId}`}
                            className="text-brand-700 hover:underline"
                          >
                            {i.address}
                          </Link>
                        ) : (
                          <span>{i.address}</span>
                        )}
                        <span className="ml-auto tabular-nums">{fmtCents(i.feeCents)}</span>
                      </li>
                    ))}
                  </ul>
                  {r.status !== "PAID" && (
                    <form
                      action={markPaymentRequestPaid}
                      className="mt-2 flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="id" value={r.id} />
                      <label className={`${label} min-w-52`}>
                        How it was paid (optional)
                        <input
                          name="paidNote"
                          className={`${input} py-1 text-xs`}
                          placeholder="check #1042"
                        />
                      </label>
                      <button type="submit" className={btnGhost}>
                        Mark paid
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
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
