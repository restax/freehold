import { prisma, withVendor } from "@freehold/db";
import { VendorOrderThread } from "@/components/vendor-order-thread";
import { sendOrderMessageVendor, uploadOrderDocVendor } from "@/lib/actions/vendor-order-messages";
import {
  vendorAcceptOrder,
  vendorCompleteOrder,
  vendorDeclineOrder,
  vendorMarkMissed,
  vendorScheduleOrder,
} from "@/lib/actions/vendor-orders";
import { billingContactFrom } from "@/lib/client-profile";
import { fmtDate } from "@/lib/format";
import { fmtDateTime, ORDER_EVENT_LABEL, ORDER_STATUS_STYLE } from "@/lib/vendor-order-labels";
import { isOpen } from "@/lib/vendor-orders";

/**
 * The vendor's side of orders: everything a connected coordinator has sent them,
 * with the accept / schedule / miss / complete actions the state machine allows.
 * The vendor has no tenant, so orders are read through their own `app.vendor_id`
 * (withVendor) — never by trusting a tenantId from the request.
 */

const btn = "rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700";
const btnGhost =
  "rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700 hover:bg-stone-50";
const field = "rounded-lg border border-stone-300 px-2 py-1 text-xs";

export async function VendorOrderInbox({ vendorId }: { vendorId: string }) {
  const orders = await withVendor(vendorId, (tx) =>
    tx.vendorOrder.findMany({
      where: { status: { not: "DRAFT" } },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        events: { orderBy: { createdAt: "asc" } },
        messages: { orderBy: { createdAt: "asc" } },
        transaction: { select: { propertyAddress: true } },
      },
    }),
  );
  if (orders.length === 0) return null;

  // Coordinator names come from organization (a root table, no RLS).
  const orgs = await prisma.organization.findMany({
    where: { id: { in: [...new Set(orders.map((o) => o.tenantId))] } },
    select: { id: true, name: true },
  });
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  const open = orders.filter((o) => isOpen(o.status));
  const done = orders.filter((o) => !isOpen(o.status));

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="mb-3 font-medium">Your orders</h2>
      <div className="flex flex-col gap-3">
        {[...open, ...done].map((o) => {
          const billTo = billingContactFrom(o.billingContact);
          return (
            <article
              key={o.id}
              className="rounded-xl border border-stone-200 px-4 py-3"
              data-open={isOpen(o.status)}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{o.type}</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLE[o.status] ?? ""}`}
                >
                  {o.status.toLowerCase()}
                </span>
                <span className="text-sm text-stone-500">
                  {orgName.get(o.tenantId) ?? "coordinator"}
                </span>
                {o.scheduledAt && (
                  <span className="text-sm text-brand-700">
                    appointment {fmtDateTime(o.scheduledAt)}
                  </span>
                )}
                {o.dueDate && (
                  <span className="text-xs text-stone-400">needed by {fmtDate(o.dueDate)}</span>
                )}
              </div>
              <p className="mt-1 text-sm text-stone-600">
                {o.transaction.propertyAddress}
                {o.onBehalfOf && <span className="text-stone-400"> — for {o.onBehalfOf}</span>}
              </p>
              {o.details && <p className="mt-1 text-sm text-stone-600">{o.details}</p>}

              {/* Who to call, and who to bill — the two things a cold order
                otherwise makes a vendor guess at. */}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                {(o.requestedByName || o.requestedByEmail) && (
                  <span>
                    Contact: {o.requestedByName ?? o.requestedByEmail}
                    {o.requesterPhone ? ` · ${o.requesterPhone}` : ""}
                    {o.requestedByEmail && o.requestedByName ? ` · ${o.requestedByEmail}` : ""}
                  </span>
                )}
                {billTo && (
                  <span>
                    Bill to: {billTo.name}
                    {billTo.email ? ` · ${billTo.email}` : ""}
                    {billTo.phone ? ` · ${billTo.phone}` : ""}
                  </span>
                )}
              </div>

              {isOpen(o.status) && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  {o.status === "SENT" && (
                    <form action={vendorAcceptOrder}>
                      <input type="hidden" name="id" value={o.id} />
                      <button type="submit" className={btn}>
                        Accept
                      </button>
                    </form>
                  )}

                  {/* Set or move the appointment; rescheduling keeps the old one in history. */}
                  <form action={vendorScheduleOrder} className="flex items-end gap-1.5">
                    <input type="hidden" name="id" value={o.id} />
                    <label className="flex flex-col gap-0.5 text-[11px] text-stone-500">
                      {o.status === "SCHEDULED" ? "Move appointment" : "Set appointment"}
                      <input type="datetime-local" name="scheduledAt" required className={field} />
                    </label>
                    <button type="submit" className={btnGhost}>
                      {o.status === "SCHEDULED" ? "Reschedule" : "Schedule"}
                    </button>
                  </form>

                  {o.status === "SCHEDULED" && (
                    <form action={vendorMarkMissed}>
                      <input type="hidden" name="id" value={o.id} />
                      <button type="submit" className={btnGhost}>
                        Mark missed
                      </button>
                    </form>
                  )}

                  <form action={vendorCompleteOrder}>
                    <input type="hidden" name="id" value={o.id} />
                    <button type="submit" className={btnGhost}>
                      Complete
                    </button>
                  </form>

                  {(o.status === "SENT" || o.status === "ACCEPTED") && (
                    <form action={vendorDeclineOrder} className="flex items-end gap-1.5">
                      <input type="hidden" name="id" value={o.id} />
                      <input
                        name="reason"
                        placeholder="Reason (optional)"
                        className={`${field} w-40`}
                      />
                      <button type="submit" className="text-xs text-stone-400 hover:text-red-700">
                        Decline
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Conversation with the coordinator, plus document upload. */}
              <div className="mt-3 border-t border-stone-100 pt-3">
                <VendorOrderThread messages={o.messages} mine="VENDOR" />
                <form action={sendOrderMessageVendor} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="orderId" value={o.id} />
                  <input
                    name="body"
                    required
                    placeholder="Message the coordinator…"
                    className={`${field} flex-1`}
                  />
                  <button type="submit" className={btn}>
                    Send
                  </button>
                </form>
                <form
                  action={uploadOrderDocVendor}
                  className="mt-2 flex items-center gap-2 text-xs text-stone-500"
                >
                  <input type="hidden" name="orderId" value={o.id} />
                  <input type="file" name="file" required className="text-xs" />
                  <button type="submit" className={btnGhost}>
                    Upload a document
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
            </article>
          );
        })}
      </div>
    </section>
  );
}
