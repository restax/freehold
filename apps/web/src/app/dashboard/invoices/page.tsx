import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import {
  createInvoice,
  deleteDraftInvoice,
  erpnextBaseUrl,
  erpnextConnected,
  invoicingAllowed,
  issueDraftInvoice,
  sendInvoice,
  voidInvoice,
} from "@/lib/actions/invoices";
import { markPaymentRequestPaid } from "@/lib/actions/pay";
import {
  addLateFee,
  applyClientCredit,
  recordClientCredit,
  recordInvoicePayment,
  reverseInvoicePayment,
} from "@/lib/actions/payments";
import {
  type AttributableInvoice,
  billingExceptions,
  displayState,
  type InvoiceDisplayState,
  invoiceMoney,
  PAYMENT_METHODS,
  transactionBilling,
} from "@/lib/billing";
import { filePayoutTotals } from "@/lib/billing-payouts";
import { clientBillingPolicy, lateFeeCents, lateFeeEligible } from "@/lib/billing-policy";
import { agingReport, monthlyCollected } from "@/lib/billing-reports";
import { invoiceRecipient } from "@/lib/client-profile";
import { emailEnabled } from "@/lib/email";
import { erpnextInvoiceUrl } from "@/lib/erpnext";
import { fmtDate } from "@/lib/format";
import { agingBucket, daysOverdue, invoiceLabel, TERM_PRESETS } from "@/lib/invoicing";
import { fmtCents } from "@/lib/pay";
import { getBillingAccess, requireTenant } from "@/lib/tenant";
import { btn, btnAdd, btnGhost, card, input, label, summaryLink } from "@/lib/ui";

export const dynamic = "force-dynamic";

const STATE_BADGE: Record<InvoiceDisplayState, [BadgeTone, string]> = {
  draft: ["neutral", "Draft"],
  unpaid: ["progress", "Outstanding"],
  partial: ["progress", "Partly paid"],
  paid: ["success", "Paid"],
  void: ["neutral", "Void"],
};

const CREDIT_KIND_LABEL: Record<string, string> = {
  deposit: "Deposit",
  applied: "Applied to invoice",
  refund: "Refund",
  adjustment: "Adjustment",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ invoiceError?: string }>;
}) {
  const { tenantId, userId } = await requireTenant();
  const { invoiceError } = await searchParams;
  const [allowed, access, canEmail, hasErpnext, org] = await Promise.all([
    invoicingAllowed(tenantId),
    getBillingAccess(tenantId, userId),
    Promise.resolve(emailEnabled()),
    erpnextConnected(tenantId),
    prisma.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { billingDefaults: true },
    }),
  ]);
  // Billing is permissioned, not role-bound: owners/admins always, and any
  // teammate the Team page granted view/manage/full.
  if (!access.view) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold">Invoices</h1>
          <p className="text-sm text-stone-500">
            Billing is limited to owners, admins, and teammates granted billing access. Ask a
            workspace admin to grant yours on the Team page.
          </p>
        </div>
      </div>
    );
  }
  const isAdmin = access.manage;
  const erpnextUrl = hasErpnext ? await erpnextBaseUrl(tenantId) : null;

  const payRequests = access.comp
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

  const {
    invoices,
    clients,
    transactions,
    closedFiles,
    feeUnsetCount,
    creditEntries,
    payoutBases,
  } = await withTenant(tenantId, async (tx) => ({
    invoices: await tx.invoice.findMany({
      orderBy: { number: "desc" },
      include: {
        client: {
          select: { id: true, name: true, email: true, billingConfig: true, billingContact: true },
        },
        transaction: { select: { id: true, propertyAddress: true } },
        lines: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            kind: true,
            description: true,
            amountCents: true,
            transactionId: true,
          },
        },
        payments: {
          orderBy: { receivedAt: "asc" },
          select: {
            id: true,
            amountCents: true,
            method: true,
            reference: true,
            note: true,
            source: true,
            reversesId: true,
            receivedAt: true,
            recordedByName: true,
            reversedBy: { select: { amountCents: true } },
          },
        },
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
    creditEntries: await tx.clientCreditEntry.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: { select: { id: true, name: true } } },
    }),
    payoutBases: access.comp
      ? await tx.transactionAssignee.findMany({
          where: { OR: [{ feeCents: { not: null } }, { feePercentBp: { not: null } }] },
          select: { feeCents: true, feePercentBp: true, transactionId: true },
        })
      : [],
  }));

  // Closed files billed less than expected — computed by the same attribution
  // math the file pages use.
  const attributable: AttributableInvoice[] = invoices;
  const exceptions = billingExceptions(closedFiles, (txnId) =>
    transactionBilling(txnId, attributable),
  );

  // On-account balances per client, from the append-only credit ledger.
  const creditByClient = new Map<string, { name: string; balance: number }>();
  for (const e of creditEntries) {
    const cur = creditByClient.get(e.client.id) ?? { name: e.client.name, balance: 0 };
    cur.balance += e.amountCents;
    creditByClient.set(e.client.id, cur);
  }

  // Outstanding is a balance figure now, not a face-amount figure: a half-paid
  // invoice contributes only what's still owed.
  const outstanding = invoices.filter((i) => i.status === "SENT");
  const overdue = outstanding.filter((i) => agingBucket(i.dueDate) === "overdue");
  const outstandingBalance = outstanding.reduce(
    (s, i) => s + invoiceMoney(i.lines, i.payments).balanceCents,
    0,
  );
  const overdueBalance = overdue.reduce(
    (s, i) => s + invoiceMoney(i.lines, i.payments).balanceCents,
    0,
  );

  // Reports: A/R aging over open balances, and collections by month.
  const aging = agingReport(
    outstanding.map((i) => ({
      balanceCents: invoiceMoney(i.lines, i.payments).balanceCents,
      daysPastDue: i.dueDate && agingBucket(i.dueDate) === "overdue" ? daysOverdue(i.dueDate) : 0,
    })),
  );
  const collected = monthlyCollected(
    invoices.flatMap((i) =>
      i.provider === "freehold"
        ? i.payments.map((p) => ({ amountCents: p.amountCents, receivedAt: p.receivedAt }))
        : [],
    ),
    6,
  );
  const monthMax = Math.max(1, ...collected.map((m) => m.cents));

  // Gross / payouts / net across the book — comp-visibility only, since it
  // reveals what teammates are paid. Per-file attribution keeps consolidated
  // invoices honest here too.
  const grossNet = access.comp
    ? (() => {
        const gross = invoices
          .filter((i) => i.status === "SENT" || i.status === "PAID")
          .reduce((s, i) => s + i.amountCents, 0);
        const byFile = new Map<string, { billed: number; paid: number }>();
        const fileBilling = (id: string) => {
          const hit = byFile.get(id);
          if (hit) return hit;
          const b = transactionBilling(id, invoices);
          const v = { billed: b.billedCents, paid: b.paidCents };
          byFile.set(id, v);
          return v;
        };
        let earned = 0;
        let payable = 0;
        for (const a of payoutBases) {
          const f = fileBilling(a.transactionId);
          const t = filePayoutTotals([a], f.billed, f.paid);
          earned += t.earnedCents;
          payable += t.payableCents;
        }
        return { gross, earned, payable, net: gross - earned };
      })()
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Invoices</h1>
        <p className="text-sm text-stone-500">
          Bill your clients for coordination work — however they actually pay: check, Zelle, wire,
          or out of closing proceeds. Every dollar in is a ledger entry; corrections are reversing
          entries, so the books always show what happened.
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
        <SectionCard title="Outstanding">
          <p className="text-sm text-stone-600">
            <strong className="tabular-nums">{fmtCents(outstandingBalance)}</strong> open across{" "}
            {outstanding.length} invoice{outstanding.length === 1 ? "" : "s"}
            {overdue.length > 0 && (
              <>
                {" — "}
                <strong className="tabular-nums text-red-700">{fmtCents(overdueBalance)}</strong>{" "}
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
        </SectionCard>
      )}

      {allowed && invoices.length > 0 && (
        <section className={card}>
          <details>
            <summary className={summaryLink}>Reports &amp; export</summary>
            <div className="mt-3 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                  A/R aging (open balances)
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {Object.entries(aging).map(([bucket, cents], i) => (
                    <div
                      key={bucket}
                      className={`flex flex-col ${i === 0 ? "" : "border-l border-stone-200 pl-4"}`}
                    >
                      <span className="text-[10px] uppercase tracking-wide text-stone-400">
                        {bucket}
                      </span>
                      <span
                        className={`tabular-nums text-sm font-semibold ${
                          cents > 0 && bucket !== "Current" ? "text-amber-700" : "text-stone-700"
                        }`}
                      >
                        {fmtCents(cents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                  Collected by month
                </p>
                <ul className="flex flex-col gap-1">
                  {collected.map((m) => (
                    <li key={m.month} className="flex items-center gap-2 text-xs">
                      <span className="w-14 tabular-nums text-stone-400">{m.month}</span>
                      <span
                        className="h-1.5 rounded-full bg-brand-600/80"
                        style={{ width: `${Math.max(2, (m.cents / monthMax) * 160)}px` }}
                      />
                      <span className="tabular-nums text-stone-600">{fmtCents(m.cents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {grossNet && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-stone-100 pt-3">
                {(
                  [
                    ["Gross billed", fmtCents(grossNet.gross), "text-stone-800"],
                    ["Payouts earned", fmtCents(grossNet.earned), "text-stone-800"],
                    ["Payable now", fmtCents(grossNet.payable), "text-stone-800"],
                    [
                      "Net revenue",
                      fmtCents(grossNet.net),
                      grossNet.net >= 0 ? "text-brand-700" : "text-red-700",
                    ],
                  ] as const
                ).map(([labelText, value, tone], i) => (
                  <div
                    key={labelText}
                    className={`flex flex-col ${i === 0 ? "" : "border-l border-stone-200 pl-6"}`}
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                      {labelText}
                    </span>
                    <span className={`tabular-nums text-sm font-semibold ${tone}`}>{value}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 border-t border-stone-100 pt-2 text-xs text-stone-400">
              Export for your accountant:{" "}
              <a
                href="/api/billing/export?type=invoices"
                className="font-medium text-brand-700 hover:underline"
              >
                invoices.csv
              </a>{" "}
              ·{" "}
              <a
                href="/api/billing/export?type=payments"
                className="font-medium text-brand-700 hover:underline"
              >
                payments.csv
              </a>{" "}
              — one row per charge / per payment, importable into QuickBooks and friends.
            </p>
          </details>
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
                      href={`/dashboard/transactions/${e.id}?tab=billing`}
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
              {`${feeUnsetCount} ${feeUnsetCount === 1 ? "file has" : "files have"} no expected fee set — set a standard fee on the client (or workspace default in Settings) and new files fill in automatically; existing files take a fee on their Dates & details tab.`}
            </p>
          )}
        </section>
      )}

      {allowed && isAdmin && (
        <SectionCard title="Client credit">
          <p className="mb-3 text-sm text-stone-500">
            Money held on account — retainers and pre-payments from long-standing clients, applied
            to invoices as they're issued. Every movement is an entry; the balance is their sum.
          </p>
          {creditByClient.size > 0 && (
            <ul className="mb-3 flex flex-col divide-y divide-stone-100">
              {[...creditByClient.entries()].map(([clientId, c]) => (
                <li key={clientId} className="py-1.5">
                  <details>
                    <summary className="flex cursor-pointer select-none items-baseline gap-3 text-sm hover:text-stone-900">
                      <span className="font-medium">{c.name}</span>
                      <span
                        className={`ml-auto tabular-nums font-semibold ${
                          c.balance > 0 ? "text-brand-700" : "text-stone-500"
                        }`}
                      >
                        {fmtCents(c.balance)} on account
                      </span>
                    </summary>
                    <ul className="mt-1.5 flex flex-col gap-0.5 border-l-2 border-stone-100 pl-3">
                      {creditEntries
                        .filter((e) => e.client.id === clientId)
                        .map((e) => (
                          <li key={e.id} className="flex flex-wrap gap-x-3 text-xs text-stone-500">
                            <span className="tabular-nums">{fmtDate(e.receivedAt)}</span>
                            <span
                              className={`tabular-nums font-medium ${
                                e.amountCents >= 0 ? "text-brand-700" : "text-stone-600"
                              }`}
                            >
                              {e.amountCents >= 0 ? "+" : "−"}
                              {fmtCents(Math.abs(e.amountCents))}
                            </span>
                            <span>{CREDIT_KIND_LABEL[e.kind] ?? e.kind}</span>
                            {e.method && <span>{e.method}</span>}
                            {e.reference && <span>{e.reference}</span>}
                            {e.note && <span className="text-stone-400">{e.note}</span>}
                            {e.recordedByName && (
                              <span className="ml-auto text-stone-300">{e.recordedByName}</span>
                            )}
                          </li>
                        ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <details>
            <summary className={summaryLink}>Record credit</summary>
            <form action={recordClientCredit} className="mt-3 flex flex-wrap items-end gap-2">
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
                Type
                <select name="kind" className={input} defaultValue="deposit">
                  <option value="deposit">Deposit received</option>
                  <option value="refund">Refund to client</option>
                  <option value="adjustment_add">Adjustment +</option>
                  <option value="adjustment_remove">Adjustment −</option>
                </select>
              </label>
              <label className={label}>
                Amount ($) *
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  placeholder="500.00"
                  className={`${input} w-28`}
                />
              </label>
              <label className={label}>
                Method
                <input name="method" list="payment-methods" className={`${input} w-32`} />
              </label>
              <label className={label}>
                Reference
                <input name="reference" placeholder="check #1042" className={`${input} w-32`} />
              </label>
              <label className={`${label} min-w-40 flex-1`}>
                Note
                <input name="note" className={input} />
              </label>
              <button type="submit" className={btnGhost}>
                Record
              </button>
            </form>
          </details>
        </SectionCard>
      )}

      {isAdmin && payRequests.length > 0 && (
        <SectionCard title="Pay requests">
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
        </SectionCard>
      )}

      {allowed && isAdmin && (
        <details open={invoices.length === 0}>
          <summary className={`${btnAdd} w-fit list-none`}>+ New invoice</summary>
          <form action={createInvoice} className={`${card} mt-3 flex flex-wrap items-end gap-3`}>
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
            Issuing opens a follow-up task that closes itself when the invoice is paid off. Clients
            need an email address on file to be sent the invoice.
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
          <>
            <datalist id="payment-methods">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <ul className="flex flex-col divide-y divide-stone-100">
              {invoices.map((inv) => {
                const money = invoiceMoney(inv.lines, inv.payments);
                const state = displayState(inv.status, money);
                const [tone, stateText] = STATE_BADGE[state];
                const isOverdue = inv.status === "SENT" && agingBucket(inv.dueDate) === "overdue";
                const isFreehold = inv.provider === "freehold";
                const paidShown =
                  !isFreehold && inv.status === "PAID" ? money.totalCents : money.paidCents;
                const balanceShown = money.totalCents - paidShown;
                const policy = clientBillingPolicy(org.billingDefaults, inv.client?.billingConfig);
                const suggestLateFee =
                  isAdmin &&
                  isFreehold &&
                  inv.status === "SENT" &&
                  isOverdue &&
                  inv.dueDate != null &&
                  lateFeeEligible(
                    policy.lateFee,
                    inv.dueDate,
                    daysOverdue(inv.dueDate),
                    inv.lines.some((l) => l.kind === "late_fee"),
                  );
                const clientCredit = inv.client
                  ? (creditByClient.get(inv.client.id)?.balance ?? 0)
                  : 0;

                return (
                  <li key={inv.id}>
                    <details>
                      <summary className="flex cursor-pointer select-none flex-col gap-1 py-2 text-sm hover:bg-stone-50 lg:flex-row lg:items-baseline lg:justify-between lg:gap-4">
                        <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="font-medium">{invoiceLabel(inv.number)}</span>
                          <Badge tone={tone}>{stateText}</Badge>
                          <span className="text-stone-500">{inv.client?.name ?? "—"}</span>
                          {inv.transaction && (
                            <span className="text-xs text-stone-400">
                              {inv.transaction.propertyAddress}
                            </span>
                          )}
                        </span>
                        <span className="grid shrink-0 grid-cols-[6.5rem_6rem_5.5rem_5.5rem_5.5rem] items-baseline gap-x-4 text-xs tabular-nums">
                          <span className="text-stone-400">
                            {inv.sentAt
                              ? `sent ${fmtDate(inv.sentAt)}`
                              : inv.status === "DRAFT"
                                ? "draft"
                                : "—"}
                          </span>
                          <span
                            className={isOverdue ? "font-medium text-red-700" : "text-stone-300"}
                          >
                            {isOverdue && inv.dueDate
                              ? `${daysOverdue(inv.dueDate)}d overdue`
                              : "—"}
                          </span>
                          <span className="text-right font-semibold text-stone-800">
                            {fmtCents(money.totalCents)}
                          </span>
                          <span
                            className={
                              paidShown > 0
                                ? "text-right text-brand-700"
                                : "text-right text-stone-300"
                            }
                          >
                            {paidShown > 0 ? `${fmtCents(paidShown)} paid` : "—"}
                          </span>
                          <span
                            className={
                              inv.status !== "VOID" && inv.status !== "DRAFT" && balanceShown > 0
                                ? "text-right font-medium text-amber-700"
                                : "text-right text-stone-300"
                            }
                          >
                            {inv.status !== "VOID" && inv.status !== "DRAFT" && balanceShown > 0
                              ? `${fmtCents(balanceShown)} due`
                              : "—"}
                          </span>
                        </span>
                      </summary>

                      <div className="mb-2 grid gap-4 rounded-lg bg-stone-50 p-3 lg:grid-cols-2">
                        <div className="flex flex-col gap-3">
                          <div>
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                              Charges
                            </p>
                            <ul className="flex flex-col gap-0.5">
                              {inv.lines.map((l) => (
                                <li key={l.id} className="flex gap-3 text-xs text-stone-600">
                                  <span>{l.description}</span>
                                  {l.kind !== "service" && (
                                    <span className="text-stone-400">
                                      ({l.kind.replace("_", " ")})
                                    </span>
                                  )}
                                  <span className="ml-auto tabular-nums">
                                    {fmtCents(l.amountCents)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                              Payments
                            </p>
                            {!isFreehold ? (
                              <p className="text-xs text-stone-400">
                                Managed in ERPNext — Freehold mirrors the status.
                              </p>
                            ) : inv.payments.length === 0 ? (
                              <p className="text-xs text-stone-400">Nothing received yet.</p>
                            ) : (
                              <ul className="flex flex-col gap-1">
                                {inv.payments.map((p) => {
                                  const reversed =
                                    p.reversedBy.reduce((s, r) => s + r.amountCents, 0) < 0;
                                  return (
                                    <li
                                      key={p.id}
                                      className="flex flex-wrap items-baseline gap-x-3 text-xs"
                                    >
                                      <span className="tabular-nums text-stone-400">
                                        {fmtDate(p.receivedAt)}
                                      </span>
                                      <span
                                        className={`tabular-nums font-medium ${
                                          p.amountCents >= 0 ? "text-brand-700" : "text-red-700"
                                        } ${reversed ? "line-through opacity-60" : ""}`}
                                      >
                                        {p.amountCents >= 0 ? "+" : "−"}
                                        {fmtCents(Math.abs(p.amountCents))}
                                      </span>
                                      {p.method && (
                                        <span className="text-stone-500">{p.method}</span>
                                      )}
                                      {p.reference && (
                                        <span className="text-stone-500">{p.reference}</span>
                                      )}
                                      {p.note && <span className="text-stone-400">{p.note}</span>}
                                      {p.recordedByName && (
                                        <span className="text-stone-300">{p.recordedByName}</span>
                                      )}
                                      {isAdmin &&
                                        p.amountCents > 0 &&
                                        p.source === "direct" &&
                                        !reversed &&
                                        inv.status !== "VOID" && (
                                          <form
                                            action={reverseInvoicePayment}
                                            className="ml-auto flex items-center gap-1"
                                          >
                                            <input type="hidden" name="paymentId" value={p.id} />
                                            <input
                                              name="note"
                                              placeholder="check returned"
                                              className={`${input} w-28 px-2 py-0.5 text-xs`}
                                            />
                                            <button
                                              type="submit"
                                              className="text-xs text-stone-400 hover:text-red-600"
                                              title="Write a reversing entry — history is never edited"
                                            >
                                              reverse
                                            </button>
                                          </form>
                                        )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            {!isFreehold && inv.externalId && erpnextUrl ? (
                              <a
                                href={erpnextInvoiceUrl(erpnextUrl, inv.externalId)}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-brand-700 hover:text-brand-600"
                              >
                                open in ERPNext →
                              </a>
                            ) : (
                              <a
                                href={`/api/invoices/${inv.id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-brand-700 hover:text-brand-600"
                              >
                                PDF
                              </a>
                            )}
                            {isAdmin &&
                              inv.status === "SENT" &&
                              canEmail &&
                              inv.client &&
                              invoiceRecipient(inv.client) && (
                                <form action={sendInvoice}>
                                  <input type="hidden" name="id" value={inv.id} />
                                  <button
                                    type="submit"
                                    className="font-medium text-brand-700 hover:text-brand-600"
                                    title={`Emails ${invoiceRecipient(inv.client)}`}
                                  >
                                    {inv.sentAt
                                      ? `re-send (emailed ${fmtDate(inv.sentAt)})`
                                      : "send"}
                                  </button>
                                </form>
                              )}
                            {inv.paymentTerms && (
                              <span className="text-stone-400">{inv.paymentTerms}</span>
                            )}
                            {inv.dueDate && (
                              <span className="text-stone-400">due {fmtDate(inv.dueDate)}</span>
                            )}
                            {isAdmin && inv.status === "SENT" && (
                              <form action={voidInvoice} className="ml-auto">
                                <input type="hidden" name="id" value={inv.id} />
                                <button type="submit" className="text-stone-400 hover:text-red-600">
                                  void
                                </button>
                              </form>
                            )}
                          </div>

                          {isAdmin && inv.status === "DRAFT" && (
                            <div className="flex flex-wrap items-center gap-2">
                              <form
                                action={issueDraftInvoice}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <input type="hidden" name="id" value={inv.id} />
                                <label className="flex items-center gap-1.5 text-xs text-stone-600">
                                  <input
                                    type="checkbox"
                                    name="dueAtClosing"
                                    value="1"
                                    defaultChecked={Boolean(inv.transaction)}
                                    className="accent-brand-600"
                                  />
                                  due at closing
                                </label>
                                <input
                                  name="dueDate"
                                  type="date"
                                  className={`${input} px-2 py-1 text-xs`}
                                />
                                <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                                  Issue invoice
                                </button>
                              </form>
                              <form action={deleteDraftInvoice}>
                                <input type="hidden" name="id" value={inv.id} />
                                <button
                                  type="submit"
                                  className="text-xs text-stone-400 hover:text-red-600"
                                >
                                  discard draft
                                </button>
                              </form>
                            </div>
                          )}

                          {isAdmin && isFreehold && inv.status === "SENT" && (
                            <>
                              <form
                                action={recordInvoicePayment}
                                className="flex flex-wrap items-end gap-2"
                              >
                                <input type="hidden" name="id" value={inv.id} />
                                <label className={label}>
                                  Amount ($)
                                  <input
                                    name="amount"
                                    inputMode="decimal"
                                    required
                                    defaultValue={
                                      balanceShown > 0 ? (balanceShown / 100).toFixed(2) : ""
                                    }
                                    className={`${input} w-24 px-2 py-1 text-xs`}
                                  />
                                </label>
                                <label className={label}>
                                  Method
                                  <input
                                    name="method"
                                    list="payment-methods"
                                    className={`${input} w-28 px-2 py-1 text-xs`}
                                  />
                                </label>
                                <label className={label}>
                                  Reference
                                  <input
                                    name="reference"
                                    placeholder="check #1042"
                                    className={`${input} w-28 px-2 py-1 text-xs`}
                                  />
                                </label>
                                <label className={label}>
                                  Received
                                  <input
                                    name="receivedAt"
                                    type="date"
                                    className={`${input} px-2 py-1 text-xs`}
                                  />
                                </label>
                                <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                                  Record payment
                                </button>
                              </form>
                              <div className="flex flex-wrap items-center gap-2">
                                {clientCredit > 0 && balanceShown > 0 && (
                                  <form
                                    action={applyClientCredit}
                                    className="flex items-end gap-1.5"
                                  >
                                    <input type="hidden" name="id" value={inv.id} />
                                    <label className={label}>
                                      Apply credit ({fmtCents(clientCredit)} available)
                                      <input
                                        name="amount"
                                        inputMode="decimal"
                                        defaultValue={(
                                          Math.min(clientCredit, balanceShown) / 100
                                        ).toFixed(2)}
                                        className={`${input} w-24 px-2 py-1 text-xs`}
                                      />
                                    </label>
                                    <button
                                      type="submit"
                                      className={`${btnGhost} px-2 py-1 text-xs`}
                                    >
                                      Apply
                                    </button>
                                  </form>
                                )}
                                {suggestLateFee && (
                                  <form action={addLateFee}>
                                    <input type="hidden" name="id" value={inv.id} />
                                    <button
                                      type="submit"
                                      className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
                                    >
                                      + Late fee{" "}
                                      {fmtCents(lateFeeCents(policy.lateFee, inv.amountCents))}
                                    </button>
                                  </form>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
