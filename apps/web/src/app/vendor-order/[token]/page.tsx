import { Buildings, Envelope, Phone } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { VendorOrderThread } from "@/components/vendor-order-thread";
import {
  linkAcceptOrder,
  linkCompleteOrder,
  linkDeclineOrder,
  linkScheduleOrder,
  linkSendMessage,
  linkUploadDoc,
} from "@/lib/actions/vendor-order-link";
import { billingContactFrom } from "@/lib/client-profile";
import { fmtDate } from "@/lib/format";
import { fmtDateTime, ORDER_STATUS_STYLE } from "@/lib/vendor-order-labels";
import { resolveOrderLink } from "@/lib/vendor-order-links";
import { isOpen } from "@/lib/vendor-orders";

export const dynamic = "force-dynamic";

const btn =
  "w-full rounded-lg bg-brand-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-brand-700";
const btnGhost =
  "w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-center text-sm text-stone-700 hover:bg-stone-50";
const field = "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm";

/**
 * The public, no-account page an emailed vendor lands on from their order
 * link. Most opens are on a phone from a Gmail app, so this is built
 * mobile-first: one column, full-width tap targets, nothing that needs a
 * hover to discover. Everything is driven by the capability token; there is
 * no session here.
 *
 * Freehold's own name stays out of the top of the page on purpose — the
 * vendor doesn't know or care who built this, they need to know who's
 * asking and what for. It appears once, small, at the bottom.
 */
export default async function VendorOrderLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveOrderLink(token);

  if (!resolved) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6 py-12">
        <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <h1 className="font-medium text-stone-800">This link is no longer active</h1>
          <p className="mt-2 text-sm text-stone-500">
            It may have expired or been withdrawn. Reply to the coordinator's email, or ask them to
            resend the order.
          </p>
        </div>
      </main>
    );
  }

  const billTo = billingContactFrom(resolved.order.billingContact);

  return (
    <main className="flex min-h-screen flex-col items-center bg-stone-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        {/* Who's asking, and what for — the two things that matter in the
            first three seconds on a phone. */}
        <div className="border-b border-stone-100 bg-stone-50/60 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Service request from
          </p>
          <p className="mt-0.5 text-base font-semibold text-stone-800">{resolved.tenantName}</p>
        </div>

        <div className="px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-stone-900">{resolved.order.type}</h1>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLE[resolved.order.status] ?? ""}`}
            >
              {resolved.order.status.toLowerCase()}
            </span>
          </div>
          {resolved.property && (
            <p className="mt-1 text-sm text-stone-600">
              {resolved.property}
              {resolved.order.onBehalfOf && (
                <span className="text-stone-400"> — for {resolved.order.onBehalfOf}</span>
              )}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-400">
            {resolved.order.dueDate && <span>Needed by {fmtDate(resolved.order.dueDate)}</span>}
            {resolved.order.scheduledAt && (
              <span className="text-brand-700">
                Appointment {fmtDateTime(resolved.order.scheduledAt)}
              </span>
            )}
          </div>
          {resolved.order.details && (
            <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2.5 text-sm text-stone-700">
              {resolved.order.details}
            </p>
          )}

          {/* Everything a vendor otherwise has to ask for by email: who to
              call about the job, and who to bill when it's done. */}
          {(resolved.order.requestedByName || resolved.order.requestedByEmail || billTo) && (
            <div className="mt-4 flex flex-col gap-2">
              {(resolved.order.requestedByName || resolved.order.requestedByEmail) && (
                <ContactCard
                  icon={<Buildings size={15} weight="fill" aria-hidden />}
                  heading="Order contact"
                  name={resolved.order.requestedByName ?? resolved.order.requestedByEmail ?? ""}
                  email={resolved.order.requestedByEmail}
                  phone={resolved.order.requesterPhone}
                />
              )}
              {billTo && (
                <ContactCard
                  icon={<Envelope size={15} weight="fill" aria-hidden />}
                  heading="Send the invoice to"
                  name={billTo.name ?? "—"}
                  email={billTo.email}
                  phone={billTo.phone}
                />
              )}
            </div>
          )}

          {isOpen(resolved.order.status as never) ? (
            <div className="mt-5 flex flex-col gap-3 border-t border-stone-100 pt-5">
              {resolved.order.status === "SENT" && (
                <form action={linkAcceptOrder}>
                  <input type="hidden" name="token" value={token} />
                  <button type="submit" className={btn}>
                    Accept this order
                  </button>
                </form>
              )}

              <form action={linkScheduleOrder} className="flex flex-col gap-2">
                <input type="hidden" name="token" value={token} />
                <span className="text-xs font-medium text-stone-500">
                  {resolved.order.scheduledAt ? "Move the appointment" : "Set an appointment"}
                </span>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  required
                  aria-label="Appointment date and time"
                  className={field}
                />
                <button type="submit" className={btnGhost}>
                  {resolved.order.scheduledAt ? "Reschedule" : "Schedule"}
                </button>
              </form>

              <div className="grid grid-cols-2 gap-2">
                <form action={linkCompleteOrder}>
                  <input type="hidden" name="token" value={token} />
                  <button type="submit" className={btnGhost}>
                    Mark complete
                  </button>
                </form>
                {(resolved.order.status === "SENT" || resolved.order.status === "ACCEPTED") && (
                  <form action={linkDeclineOrder} className="flex flex-col gap-1.5">
                    <input type="hidden" name="token" value={token} />
                    <input name="reason" placeholder="Reason (optional)" className={field} />
                    <button
                      type="submit"
                      className="text-xs font-medium text-stone-400 hover:text-red-700"
                    >
                      Decline this order
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-5 border-t border-stone-100 pt-5 text-sm text-stone-500">
              Nothing more to do here — this order is {resolved.order.status.toLowerCase()}.
            </p>
          )}

          {/* Talk to the coordinator and send documents, no account needed. */}
          <div className="mt-5 border-t border-stone-100 pt-5">
            <p className="mb-2 text-xs font-medium text-stone-500">Have a question first?</p>
            <VendorOrderThread messages={resolved.messages} mine="VENDOR" />
            <form action={linkSendMessage} className="mt-2 flex flex-col gap-2">
              <input type="hidden" name="token" value={token} />
              <input
                name="body"
                required
                placeholder="e.g. Need to see the property first, or ask about the rate…"
                className={field}
              />
              <button type="submit" className={btnGhost}>
                Send message
              </button>
            </form>
            <form
              action={linkUploadDoc}
              className="mt-2 flex items-center gap-2 text-xs text-stone-500"
            >
              <input type="hidden" name="token" value={token} />
              <input type="file" name="file" required className="min-w-0 flex-1 text-xs" />
              <button
                type="submit"
                className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700 hover:bg-stone-50"
              >
                Upload
              </button>
            </form>
          </div>
        </div>

        {/* Freehold appears once, small, down here — this page is about the
            coordinator's request, not about us. */}
        <div className="border-t border-stone-100 bg-stone-50/60 px-5 py-4 text-center">
          <p className="text-xs text-stone-400">
            This ordering system is part of the TC admin package provided by Freehold Cloud.
          </p>
          <p className="mt-1 text-xs text-stone-400">
            Work with lots of coordinators?{" "}
            <Link href="/vendor/register" className="font-medium text-brand-600 hover:underline">
              Register as a vendor
            </Link>{" "}
            (free) to see every order in one place.
          </p>
        </div>
      </div>
    </main>
  );
}

function ContactCard({
  icon,
  heading,
  name,
  email,
  phone,
}: {
  icon: ReactNode;
  heading: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}) {
  return (
    <div className="rounded-lg border border-stone-200 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-400">
        {icon}
        {heading}
      </p>
      <p className="mt-0.5 text-sm font-medium text-stone-800">{name}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {phone && (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            className="flex items-center gap-1 text-xs text-brand-700 hover:underline"
          >
            <Phone size={12} weight="fill" aria-hidden />
            {phone}
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-1 text-xs text-brand-700 hover:underline"
          >
            <Envelope size={12} weight="fill" aria-hidden />
            {email}
          </a>
        )}
      </div>
    </div>
  );
}
