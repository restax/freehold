import { withTenant } from "@freehold/db";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import {
  createInvoice,
  erpnextBaseUrl,
  erpnextConnected,
  invoicingAllowed,
  markInvoicePaid,
  sendInvoice,
  voidInvoice,
} from "@/lib/actions/invoices";
import { markPaymentRequestPaid } from "@/lib/actions/pay";
import { type AttributableInvoice, billingExceptions, transactionBilling } from "@/lib/billing";
import { emailEnabled } from "@/lib/email";
import { erpnextInvoiceUrl } from "@/lib/erpnext";
import { fmtDate } from "@/lib/format";
import { agingBucket, daysOverdue, invoiceLabel, TERM_PRESETS } from "@/lib/invoicing";
import { fmtCents } from "@/lib/pay";
import { getMemberRole, requireTenant } from "@/lib/tenant";
import {
  btn,
  btnGhost,
  card,
  input,
  label,
  summaryLink,
  tableWrap,
  td,
  th,
  trHover,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  SENT: "progress",
  PAID: "success",
  VOID: "neutral",
};

const STATUS_TEXT: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Outstanding",
  PAID: "Paid",
  VOID: "Void",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ invoiceError?: string }>;
}) {
  const { tenantId, userId } = await requireTenant();
  const { invoiceError } = await searchParams;
  const [allowed, role, canEmail, hasErpnext] = await Promise.all([
    invoicingAllowed(tenantId),
    getMemberRole(tenantId, userId),
    Promise.resolve(emailEnabled()),
    erpnextConnected(tenantId),
  ]);
  const isAdmin = role === "owner" || role === "admin";
  // Only needed to deep-link rows back into their instance.
  const erpnextUrl = hasErpnext ? await erpnextBaseUrl(tenantId) : null;
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
  const { invoices, clients, transactions, closedFiles, feeUnsetCount } = await withTenant(
    tenantId,
    async (tx) => ({
      invoices: await tx.invoice.findMany({
        orderBy: { number: "desc" },
        include: {
          client: { select: { name: true, email: true } },
          transaction: { select: { id: true, propertyAddress: true } },
          lines: { select: { transactionId: true, amountCents: true } },
          payments: { select: { amountCents: true } },
        },
      }),
      clients: await tx.client.findMany({ orderBy: { name: "asc" } }),
      transactions: await tx.transaction.findMany({
        where: { status: { notIn: ["CANCELLED"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true, propertyAddress: true },
        take: 100,
      }),
      // The trust surface: every closed file, checked against what was billed.
      closedFiles: await tx.transaction.findMany({
        where: { status: "CLOSED" },
        select: { id: true, propertyAddress: true, status: true, expectedFeeCents: true },
      }),
      feeUnsetCount: await tx.transaction.count({
        where: { status: { notIn: ["CANCELLED"] }, expectedFeeCents: null },
      }),
    }),
  );

  // Closed files billed less than expected — the "am I paid on every file?"
  // answer, computed by the same attribution math the file pages use.
  const attributable: AttributableInvoice[] = invoices;
  const exceptions = billingExceptions(closedFiles, (txnId) =>
    transactionBilling(txnId, attributable),
  );

  const outstanding = invoices.filter((i) => i.status === "SENT");
  const overdue = outstanding.filter((i) => agingBucket(i.dueDate) === "overdue");
  const outstandingTotal = outstanding.reduce((s, i) => s + i.amountCents, 0);
  const overdueTotal = overdue.reduce((s, i) => s + i.amountCents, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Invoices</h1>
        <p className="text-sm text-stone-500">
          Bill your clients for coordination work — however they actually pay: check, Zelle, wire,
          or out of closing proceeds. Freehold generates the invoice, emails it, and keeps a
          follow-up task open until you mark it paid.
        </p>
      </div>

      {invoiceError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{invoiceError}</p>
      )}

      {!allowed && (
        <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600">
          Client invoicing is available on paid plans.{" "}
          <Link href="/dashboard/billing" className="font-medium text-brand-700 underline">
            See plans
          </Link>
          .
        </p>
      )}

      {allowed && outstanding.length > 0 && (
        <section className={card}>
          <h2 className="mb-1 font-medium">Outstanding</h2>
          <p className="text-sm text-stone-600">
            <strong className="tabular-nums">{fmtCents(outstandingTotal)}</strong> across{" "}
            {outstanding.length} invoice{outstanding.length === 1 ? "" : "s"}
            {overdue.length > 0 && (
              <>
                {" — "}
                <strong className="tabular-nums text-red-700">{fmtCents(overdueTotal)}</strong>{" "}
                <span className="text-red-700">
                  overdue ({overdue.length} invoice{overdue.length === 1 ? "" : "s"})
                </span>
              </>
            )}
            .
          </p>
          <p className="mt-1 text-xs text-stone-400">
            Get this as an email every morning — switch it on under Settings → Invoice report.
          </p>
        </section>
      )}

      {allowed && isAdmin && (exceptions.length > 0 || feeUnsetCount > 0) && (
        <section className={`${card} ${exceptions.length > 0 ? "border-amber-300/70" : ""}`}>
          <h2 className="mb-1 font-medium">Billing health</h2>
          {exceptions.length > 0 ? (
            <>
              <p className="mb-2 text-sm text-stone-600">
                {exceptions.length} closed file{exceptions.length === 1 ? "" : "s"} billed less than
                expected — money on the table until these are invoiced.
              </p>
              <ul className="flex flex-col divide-y divide-stone-100">
                {exceptions.slice(0, 8).map((e) => (
                  <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 py-1.5 text-sm">
                    <Link
                      href={`/dashboard/transactions/${e.id}`}
                      className="font-medium text-brand-700 hover:text-brand-600"
                    >
                      {e.propertyAddress}
                    </Link>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                      {e.kind === "unbilled_closed" ? "nothing billed" : "underbilled"}
                    </span>
                    <span className="ml-auto tabular-nums text-stone-500">
                      {fmtCents(e.billedCents)} of {fmtCents(e.expectedCents)} billed
                      <span className="ml-2 font-medium text-amber-800">
                        {fmtCents(e.shortfallCents)} short
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {exceptions.length > 8 && (
                <p className="mt-1 text-xs text-stone-400">+{exceptions.length - 8} more.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-emerald-700">
              Every closed file with an expected fee is fully billed.
            </p>
          )}
          {feeUnsetCount > 0 && (
            <p className="mt-2 text-xs text-stone-400">
              {feeUnsetCount} file{feeUnsetCount === 1 ? "" : "s"}{" "}
              {feeUnsetCount === 1 ? "has" : "have"} no expected fee set — set a
              standard fee on the client (or workspace default in Settings) and new files fill in
              automatically; existing files take a fee on their Dates &amp; details tab.
            </p>
          )}
        </section>
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
                <li key={r.id} className="border-b border-stone-100 py-2 last:border-0">
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

      {allowed && isAdmin && (
        <details className={card} open={invoices.length === 0}>
          <summary className={summaryLink}>New invoice</summary>
          <form action={createInvoice} className="mt-4 flex flex-wrap items-end gap-3">
            <label className={label}>
              Client *
              <select name="clientId" required className={input} defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {clients.map((c) => (
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
              Payment terms
              <input
                name="paymentTerms"
                list="term-presets"
                placeholder="Due at closing"
                className={input}
              />
              <datalist id="term-presets">
                {TERM_PRESETS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <label className={label}>
              Due
              <input name="dueDate" type="date" className={input} />
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
            {hasErpnext && (
              <label className={label}>
                Create in
                <select name="provider" className={input} defaultValue="freehold">
                  <option value="freehold">Freehold</option>
                  <option value="erpnext">ERPNext</option>
                </select>
              </label>
            )}
            <button type="submit" className={btn}>
              Issue invoice
            </button>
          </form>
          <p className="mt-2 text-xs text-stone-400">
            Issuing opens a follow-up task that closes itself when the invoice is marked paid.
            Clients need an email address on file to be sent the invoice.
          </p>
        </details>
      )}

      <section className={card}>
        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            hint="Issue one above — Freehold generates the PDF, emails it to your client, and keeps a follow-up open until it's paid."
          />
        ) : (
          <div className={tableWrap}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Client</th>
                  <th className={th}>Amount</th>
                  <th className={th}>Terms</th>
                  <th className={th}>Due</th>
                  <th className={th}>Status</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const isOverdue = inv.status === "SENT" && agingBucket(inv.dueDate) === "overdue";
                  return (
                    <tr key={inv.id} className={trHover}>
                      <td className={`${td} font-medium`}>
                        {invoiceLabel(inv.number)}
                        {inv.transaction && (
                          <Link
                            href={`/dashboard/transactions/${inv.transaction.id}`}
                            className="ml-2 text-xs text-brand-700 hover:underline"
                          >
                            {inv.transaction.propertyAddress}
                          </Link>
                        )}
                      </td>
                      <td className={td}>{inv.client?.name ?? "—"}</td>
                      <td className={`${td} tabular-nums`}>{fmtCents(inv.amountCents)}</td>
                      <td className={td}>{inv.paymentTerms ?? "—"}</td>
                      <td className={td}>
                        {inv.dueDate ? (
                          <span className={isOverdue ? "font-medium text-red-700" : undefined}>
                            {fmtDate(inv.dueDate)}
                            {isOverdue && ` (${daysOverdue(inv.dueDate)}d)`}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={td}>
                        <span className="flex items-center gap-1.5">
                          <Badge tone={STATUS_TONE[inv.status] ?? "neutral"}>
                            {STATUS_TEXT[inv.status] ?? inv.status}
                          </Badge>
                          {inv.status === "SENT" && inv.sentAt && (
                            <span className="text-xs text-stone-400">
                              emailed {fmtDate(inv.sentAt)}
                            </span>
                          )}
                          {inv.status === "PAID" && inv.paidNote && (
                            <span className="text-xs text-stone-400">({inv.paidNote})</span>
                          )}
                        </span>
                      </td>
                      <td className={td}>
                        <span className="flex flex-wrap items-center gap-3">
                          {inv.provider === "erpnext" && inv.externalId && erpnextUrl ? (
                            <a
                              href={erpnextInvoiceUrl(erpnextUrl, inv.externalId)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-brand-700 hover:text-brand-600"
                              title={inv.externalId}
                            >
                              open in ERPNext →
                            </a>
                          ) : (
                            <a
                              href={`/api/invoices/${inv.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-brand-700 hover:text-brand-600"
                            >
                              PDF
                            </a>
                          )}
                          {isAdmin && inv.status === "SENT" && canEmail && inv.client?.email && (
                            <form action={sendInvoice}>
                              <input type="hidden" name="id" value={inv.id} />
                              <button
                                type="submit"
                                className="text-xs font-medium text-brand-700 hover:text-brand-600"
                              >
                                {inv.sentAt ? "re-send" : "send"}
                              </button>
                            </form>
                          )}
                          {isAdmin && inv.status === "SENT" && (
                            <form action={markInvoicePaid} className="flex items-center gap-1">
                              <input type="hidden" name="id" value={inv.id} />
                              <input
                                name="paidNote"
                                placeholder="check #1042"
                                className={`${input} w-28 px-2 py-1 text-xs`}
                              />
                              <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                                Mark paid
                              </button>
                            </form>
                          )}
                          {isAdmin && inv.status === "SENT" && (
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
