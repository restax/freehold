import Link from "next/link";
import { Wordmark } from "@/components/marketing";
import {
  linkAcceptOrder,
  linkCompleteOrder,
  linkDeclineOrder,
  linkScheduleOrder,
} from "@/lib/actions/vendor-order-link";
import { fmtDate } from "@/lib/format";
import { fmtDateTime, ORDER_STATUS_STYLE } from "@/lib/vendor-order-labels";
import { resolveOrderLink } from "@/lib/vendor-order-links";
import { isOpen } from "@/lib/vendor-orders";

export const dynamic = "force-dynamic";

const btn = "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700";
const btnGhost =
  "rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50";
const field = "rounded-lg border border-stone-300 px-3 py-2 text-sm";

/**
 * The public, no-account page an emailed vendor lands on from their order link.
 * Everything is driven by the capability token; there is no session here.
 */
export default async function VendorOrderLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveOrderLink(token);

  return (
    <main className="flex min-h-screen flex-col items-center bg-stone-50 px-6 py-12">
      <div className="mb-6">
        <Wordmark />
      </div>

      {!resolved ? (
        <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <h1 className="font-medium text-stone-800">This link is no longer active</h1>
          <p className="mt-2 text-sm text-stone-500">
            It may have expired or been withdrawn. Reply to the coordinator's email, or ask them to
            resend the order.
          </p>
        </div>
      ) : (
        <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-500">{resolved.tenantName} sent you an order</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{resolved.order.type}</h1>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLE[resolved.order.status] ?? ""}`}
            >
              {resolved.order.status.toLowerCase()}
            </span>
          </div>
          {resolved.property && <p className="mt-1 text-sm text-stone-600">{resolved.property}</p>}
          {resolved.order.details && (
            <p className="mt-2 text-sm text-stone-600">{resolved.order.details}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-400">
            {resolved.order.dueDate && <span>Needed by {fmtDate(resolved.order.dueDate)}</span>}
            {resolved.order.scheduledAt && (
              <span className="text-brand-700">
                Appointment {fmtDateTime(resolved.order.scheduledAt)}
              </span>
            )}
          </div>

          {isOpen(resolved.order.status as never) ? (
            <div className="mt-5 flex flex-col gap-4 border-t border-stone-100 pt-5">
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
                <div className="flex flex-wrap items-center gap-2">
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
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-2">
                <form action={linkCompleteOrder}>
                  <input type="hidden" name="token" value={token} />
                  <button type="submit" className={btnGhost}>
                    Mark complete
                  </button>
                </form>
                {(resolved.order.status === "SENT" || resolved.order.status === "ACCEPTED") && (
                  <form action={linkDeclineOrder} className="flex items-center gap-2">
                    <input type="hidden" name="token" value={token} />
                    <input
                      name="reason"
                      placeholder="Reason (optional)"
                      className={`${field} w-36`}
                    />
                    <button type="submit" className="text-sm text-stone-400 hover:text-red-700">
                      Decline
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

          <p className="mt-6 text-center text-xs text-stone-400">
            Work with lots of coordinators?{" "}
            <Link href="/vendor/register" className="text-brand-600 hover:underline">
              Register your business
            </Link>{" "}
            to see every order in one place.
          </p>
        </div>
      )}
    </main>
  );
}
