import { prisma, withTenant } from "@freehold/db";
import { ContactEmailField } from "@/components/contact-email-field";
import { PendingButton } from "@/components/pending-button";
import { PhoneInput } from "@/components/phone-input";
import { VendorOrderThread } from "@/components/vendor-order-thread";
import { sendOrderMessageTC } from "@/lib/actions/vendor-order-messages";
import {
  applyVendorProposal,
  cancelVendorOrder,
  dismissVendorProposal,
  emailVendorOrder,
  placeVendorOrder,
} from "@/lib/actions/vendor-orders";
import { billingContactFrom } from "@/lib/client-profile";
import { fmtDate } from "@/lib/format";
import { currentNotes } from "@/lib/handbook";
import { card } from "@/lib/ui";
import { fmtDateTime, ORDER_EVENT_LABEL, ORDER_STATUS_STYLE } from "@/lib/vendor-order-labels";

/**
 * The Vendors tab on a transaction: order connected vendors, email vendors who
 * aren't on Freehold yet, and review the AI-read proposals their replies
 * produce — nothing is applied until the coordinator clicks. Kept out of the
 * giant transaction page file; rendered by it under `tab === "vendors"`.
 */

const field =
  "rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";

const PROPOSAL_VERB: Record<string, string> = {
  ACCEPT: "Accept the order",
  DECLINE: "Decline the order",
  SCHEDULE: "Set the appointment",
  COMPLETE: "Mark complete",
  NOTE: "Add as a note",
  UNKNOWN: "Add as a note",
};

export async function VendorOrderTab({
  tenantId,
  transactionId,
}: {
  tenantId: string;
  transactionId: string;
}) {
  const [orders, activeConnections, documents, contacts, txnWithClient] = await withTenant(
    tenantId,
    async (tx) => [
      await tx.vendorOrder.findMany({
        where: { transactionId },
        orderBy: { createdAt: "desc" },
        include: {
          events: { orderBy: { createdAt: "asc" } },
          proposals: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" } },
          documents: { where: { isCurrent: true }, select: { id: true, filename: true } },
          messages: { orderBy: { createdAt: "asc" } },
        },
      }),
      await tx.vendorConnection.findMany({
        where: { status: "ACTIVE" },
        select: { vendorId: true },
      }),
      await tx.document.findMany({
        where: { transactionId, isCurrent: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, filename: true },
      }),
      // For the "email a vendor not on Freehold" picker — most vendors emailed
      // this way already exist as a Contact from some earlier file.
      await tx.contact.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true },
      }),
      // To prefill "on behalf of" and billing contact — the TC still owns the
      // final say (both fields stay editable), but most orders bill the same
      // client every time, so guessing right by default saves a re-type.
      await tx.transaction.findUnique({
        where: { id: transactionId },
        select: {
          side: true,
          client: { select: { name: true, email: true, phone: true, billingContact: true } },
        },
      }),
    ],
  );

  const sideLabel = txnWithClient?.side === "SELL_SIDE" ? "Seller" : "Buyer";
  const client = txnWithClient?.client ?? null;
  const onBehalfDefault = client ? `${client.name} (${sideLabel})` : "";
  const clientBilling = billingContactFrom(client?.billingContact) ?? {
    name: client?.name ?? null,
    email: client?.email ?? null,
    phone: client?.phone ?? null,
  };

  // Handbook notes for those contacts, so picking a vendor surfaces what the
  // team already knows about them. Only the current ones — an instruction that
  // expired last month must not be presented as if it still holds.
  const contactNotes = await withTenant(tenantId, (tx) =>
    tx.handbookNote.findMany({
      where: { subjectType: "CONTACT", subjectId: { in: contacts.map((c) => c.id) } },
      orderBy: { createdAt: "desc" },
    }),
  );
  const handbookByContact: Record<string, string[]> = {};
  for (const n of currentNotes(contactNotes, new Date())) {
    const list = handbookByContact[n.subjectId] ?? [];
    list.push(n.body);
    handbookByContact[n.subjectId] = list;
  }

  // Vendor names (root table, no RLS) for both the order rows and the picker.
  const vendorIds = [
    ...new Set([
      ...orders.map((o) => o.vendorId).filter((v): v is string => Boolean(v)),
      ...activeConnections.map((c) => c.vendorId),
    ]),
  ];
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, name: true },
  });
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
  const connectable = vendors.filter((v) => activeConnections.some((c) => c.vendorId === v.id));

  // Documents the vendor chose to share on any order they take (insurance,
  // W-9, E&O…). Vendor-owned root table, no RLS; grouped by vendor so each
  // order can show its vendor's paperwork without a per-row query.
  const sharedDocs = await prisma.vendorDocument.findMany({
    where: { vendorId: { in: vendorIds.length > 0 ? vendorIds : [""] }, shareOnOrder: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, vendorId: true, label: true },
  });
  const sharedByVendor = new Map<string, Array<{ id: string; label: string }>>();
  for (const d of sharedDocs) {
    const list = sharedByVendor.get(d.vendorId) ?? [];
    list.push({ id: d.id, label: d.label });
    sharedByVendor.set(d.vendorId, list);
  }

  return (
    <div className="flex flex-col gap-6">
      {connectable.length > 0 && (
        <section className={card}>
          <h3 className="mb-1 font-medium">Order a connected vendor</h3>
          <form action={placeVendorOrder} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="transactionId" value={transactionId} />
            <label className="flex flex-col gap-1 text-sm">
              Vendor
              <select name="vendorId" required className={field}>
                {connectable.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              What you need
              <input name="type" required placeholder="Title commitment" className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Needed by
              <input name="dueDate" type="date" className={field} />
            </label>
            <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
              Details
              <input
                name="details"
                placeholder="Anything the vendor should know"
                className={field}
              />
            </label>
            <OrderContextFields onBehalfDefault={onBehalfDefault} billing={clientBilling} />
            <PendingButton
              pendingLabel="Sending…"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Send order
            </PendingButton>
          </form>
        </section>
      )}

      <section className={card}>
        <h3 className="mb-1 font-medium">Email a vendor not on Freehold</h3>
        <p className="mb-3 text-sm text-stone-500">
          They get the order by email with a link to accept and update it — no account needed. Their
          reply comes back here as a proposed update for you to confirm.
        </p>
        <form action={emailVendorOrder} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="transactionId" value={transactionId} />
          <ContactEmailField
            contacts={contacts.map((c) => ({ id: c.id, name: c.name, hint: c.email }))}
            notesById={handbookByContact}
          />
          <label className="flex flex-col gap-1 text-sm">
            What you need
            <input name="type" required placeholder="Home inspection" className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Needed by
            <input name="dueDate" type="date" className={field} />
          </label>
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
            Details
            <input name="details" placeholder="Address, access, what to bring" className={field} />
          </label>
          <OrderContextFields onBehalfDefault={onBehalfDefault} billing={clientBilling} />
          {documents.length > 0 && (
            <fieldset className="flex w-full flex-col gap-1 text-sm">
              <span className="text-stone-500">Attach documents</span>
              <div className="flex flex-wrap gap-3">
                {documents.map((d) => (
                  <label key={d.id} className="flex items-center gap-1.5 text-xs text-stone-600">
                    <input type="checkbox" name="attachDoc" value={d.id} />
                    {d.filename}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {/* Sends a real email (and may attach documents), so the click has
              to look like it landed — otherwise it gets pressed twice and the
              vendor gets the order twice. */}
          <PendingButton
            pendingLabel="Sending…"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Email order
          </PendingButton>
        </form>
      </section>

      {orders.length === 0 ? (
        <p className="text-sm text-stone-400">No vendor orders on this file yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o) => (
            <section key={o.id} className={card}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{o.type}</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLE[o.status] ?? ""}`}
                >
                  {o.status.toLowerCase()}
                </span>
                <span className="text-sm text-stone-500">
                  {o.vendorId
                    ? (vendorName.get(o.vendorId) ?? "vendor")
                    : `by email · ${o.emailTo ?? "unregistered"}`}
                </span>
                {o.scheduledAt && (
                  <span className="text-sm text-brand-700">
                    appointment {fmtDateTime(o.scheduledAt)}
                  </span>
                )}
                {o.dueDate && (
                  <span className="text-xs text-stone-400">needed by {fmtDate(o.dueDate)}</span>
                )}
                {o.status !== "COMPLETED" &&
                  o.status !== "CANCELLED" &&
                  o.status !== "DECLINED" && (
                    <form action={cancelVendorOrder} className="ml-auto">
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="transactionId" value={transactionId} />
                      <button type="submit" className="text-xs text-stone-400 hover:text-red-700">
                        Cancel
                      </button>
                    </form>
                  )}
              </div>
              {o.details && <p className="mt-2 text-sm text-stone-600">{o.details}</p>}

              {/* AI-read proposals from the vendor's email replies — confirm or dismiss. */}
              {o.proposals.map((p) => (
                <div
                  key={p.id}
                  className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                      vendor replied
                    </span>
                    <span className="font-medium text-stone-800">{p.summary}</span>
                  </div>
                  {p.senderMismatch && (
                    <p className="mt-1 text-xs text-red-700">
                      ⚠ Sent from {p.fromAddr}, not the address this order went to — review before
                      applying.
                    </p>
                  )}
                  <p className="mt-1 whitespace-pre-wrap text-xs text-stone-500">
                    "{p.sourceText}"
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <form action={applyVendorProposal}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="transactionId" value={transactionId} />
                      <button
                        type="submit"
                        className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
                      >
                        {PROPOSAL_VERB[p.kind] ?? "Apply"}
                      </button>
                    </form>
                    <form action={dismissVendorProposal}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="transactionId" value={transactionId} />
                      <button type="submit" className="text-xs text-stone-400 hover:text-stone-700">
                        Dismiss
                      </button>
                    </form>
                  </div>
                </div>
              ))}

              {o.documents.length > 0 && (
                <p className="mt-2 text-xs text-stone-500">
                  📎 {o.documents.length} file{o.documents.length > 1 ? "s" : ""} from the vendor —
                  see the Documents tab (internal until you share).
                </p>
              )}

              {/* Paperwork the vendor keeps on file and shares on every order. */}
              {o.vendorId && (sharedByVendor.get(o.vendorId)?.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span>On file from this vendor:</span>
                  {sharedByVendor.get(o.vendorId)?.map((d) => (
                    <a
                      key={d.id}
                      href={`/api/vendor-documents/${d.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 font-medium text-stone-700 hover:border-brand-300 hover:text-brand-700"
                    >
                      {d.label}
                    </a>
                  ))}
                </div>
              )}

              {/* The order conversation, both sides. */}
              <div className="mt-3 border-t border-stone-100 pt-3">
                <VendorOrderThread messages={o.messages} mine="TC" />
                <form action={sendOrderMessageTC} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="orderId" value={o.id} />
                  <input type="hidden" name="transactionId" value={transactionId} />
                  <input
                    name="body"
                    required
                    placeholder={
                      o.vendorId ? "Message the vendor…" : "Message the vendor (also emailed)…"
                    }
                    className={`${field} flex-1`}
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    Send
                  </button>
                </form>
              </div>

              {o.events.length > 0 && (
                <ol className="mt-3 flex flex-col gap-1 border-t border-stone-100 pt-3 text-xs text-stone-500">
                  {o.events.map((e) => (
                    <li key={e.id} className="flex flex-wrap gap-2">
                      <span className="tabular-nums text-stone-400">
                        {fmtDateTime(e.createdAt)}
                      </span>
                      <span className="font-medium text-stone-700">
                        {ORDER_EVENT_LABEL[e.kind] ?? e.kind}
                      </span>
                      {e.at && <span>for {fmtDateTime(e.at)}</span>}
                      {e.detail && <span>— {e.detail}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Who this is for, and who to bill — the fields a vendor otherwise has to
 * chase down by reply. Prefilled from the file's client so the common case
 * ("bill the client who hired us") needs no typing, but every field stays
 * editable for the case it isn't ("bill the seller", "buyer's agent is the
 * contact, not us").
 */
function OrderContextFields({
  onBehalfDefault,
  billing,
}: {
  onBehalfDefault: string;
  billing: { name: string | null; email: string | null; phone: string | null };
}) {
  return (
    <fieldset className="flex w-full flex-wrap items-end gap-3 border-t border-stone-100 pt-3">
      <label className="flex flex-col gap-1 text-sm">
        On behalf of
        <input
          name="onBehalfOf"
          defaultValue={onBehalfDefault}
          placeholder="Client or party this is for"
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Your callback number
        <PhoneInput name="requesterPhone" placeholder="(312) 555-0148" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Bill to
        <input
          name="billingName"
          defaultValue={billing.name ?? ""}
          placeholder="Name"
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Billing email
        <input
          name="billingEmail"
          type="email"
          defaultValue={billing.email ?? ""}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Billing phone
        <PhoneInput name="billingPhone" defaultValue={billing.phone ?? ""} className={field} />
      </label>
    </fieldset>
  );
}
