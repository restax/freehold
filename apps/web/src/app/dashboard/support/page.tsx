import { withTenant } from "@freehold/db";
import { Phone } from "@phosphor-icons/react/dist/ssr";
import { after } from "next/server";
import { TicketBadge } from "@/components/badges";
import { PendingButton } from "@/components/pending-button";
import { addTicketReply, createTicket, setTicketStatusSelf } from "@/lib/actions/support";
import { fmtDate } from "@/lib/format";
import { getPlatformSettings } from "@/lib/platform-settings";
import { markSupportSeen } from "@/lib/support-unread";
import { getMemberRole, requireTenant } from "@/lib/tenant";
import { btn, btnGhost, input } from "@/lib/ui";

export const dynamic = "force-dynamic";

/** First line of the body, for the collapsed row — a ticket list reads like
 *  a ticket system when you can scan it without opening every thread. */
function preview(body: string): string {
  const flat = body.trim().split("\n")[0] ?? "";
  return flat.length > 90 ? `${flat.slice(0, 90)}…` : flat;
}

export default async function SupportPage() {
  const { tenantId, userId } = await requireTenant({ allowGuest: true });
  const role = await getMemberRole(tenantId, userId);
  const isAdmin = role === "owner" || role === "admin";

  // Opening the page marks everything currently here as seen — clears the
  // sidebar badge, and (on a poll-driven refresh) re-marks after a new reply.
  after(() => markSupportSeen(tenantId, userId));

  const [tickets, settings] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.supportTicket.findMany({
        where: isAdmin ? {} : { userId },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        include: {
          user: { select: { name: true, email: true } },
          replies: { orderBy: { createdAt: "asc" } },
        },
      }),
    ),
    getPlatformSettings(),
  ]);

  const open = tickets.filter((t) => t.status !== "CLOSED");
  const closed = tickets.filter((t) => t.status === "CLOSED");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-stone-500">
            {isAdmin ? "Every ticket from your workspace" : "Tickets you've filed"}
          </p>
          <h1 className="text-xl font-semibold">Support</h1>
        </div>
        {settings.contactPhone && (
          <a
            href={`tel:${settings.contactPhone.replace(/[^\d+]/g, "")}`}
            className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-xs hover:border-brand-400 hover:text-brand-700"
          >
            <Phone size={15} weight="fill" className="text-brand-600" aria-hidden />
            {settings.contactPhone}
          </a>
        )}
      </div>

      <details className="group rounded-lg border border-stone-200 bg-white open:shadow-xs">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-stone-700 marker:content-none">
          <span className="flex items-center gap-1.5">
            <span className="text-base leading-none text-brand-600 group-open:hidden">+</span>
            <span className="hidden text-base leading-none text-stone-400 group-open:inline">
              −
            </span>
            New ticket
          </span>
        </summary>
        <form
          data-tour="support-form"
          action={createTicket}
          className="flex flex-col gap-2 border-t border-stone-100 px-3 py-3 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="pagePath" value="/dashboard/support" />
          <textarea
            name="body"
            required
            rows={2}
            placeholder="What's going wrong?"
            className={`${input} flex-1 resize-y`}
          />
          <PendingButton pendingLabel="Sending…" className={`${btn} shrink-0`}>
            Send
          </PendingButton>
        </form>
      </details>

      {tickets.length === 0 ? (
        <p className="px-1 text-sm text-stone-400">Nothing yet — file one above any time.</p>
      ) : (
        <>
          <TicketList tickets={open} isAdmin={isAdmin} emptyText="Nothing open." />
          {closed.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer list-none px-1 py-1 text-xs font-medium uppercase tracking-wide text-stone-400 hover:text-stone-600">
                Closed ({closed.length})
              </summary>
              <div className="mt-1">
                <TicketList tickets={closed} isAdmin={isAdmin} emptyText="" />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function TicketList({
  tickets,
  isAdmin,
  emptyText,
}: {
  tickets: Array<{
    id: string;
    subject: string;
    body: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    pagePath: string | null;
    user: { name: string; email: string } | null;
    replies: Array<{
      id: string;
      body: string;
      fromOperator: boolean;
      authorEmail: string;
      createdAt: Date;
    }>;
  }>;
  isAdmin: boolean;
  emptyText: string;
}) {
  if (tickets.length === 0) {
    return emptyText ? <p className="px-1 text-sm text-stone-400">{emptyText}</p> : null;
  }
  return (
    <div className="flex flex-col divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white">
      {tickets.map((t) => {
        const last = t.replies[t.replies.length - 1];
        return (
          <details key={t.id} className="group">
            <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-2.5 marker:content-none hover:bg-stone-50">
              <TicketBadge status={t.status} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="truncate font-medium text-stone-800">{t.subject}</span>
                  <span className="shrink-0 text-xs text-stone-400">{fmtDate(t.updatedAt)}</span>
                </span>
                <span className="block truncate text-xs text-stone-500">
                  {isAdmin && t.user ? `${t.user.name} — ` : ""}
                  {preview(last ? last.body : t.body)}
                </span>
              </span>
              {t.replies.length > 0 && (
                <span className="shrink-0 rounded-full bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-500">
                  {t.replies.length}
                </span>
              )}
            </summary>

            <div className="border-t border-stone-100 bg-stone-50 px-3 py-3">
              <p className="whitespace-pre-wrap text-sm text-stone-700">{t.body}</p>
              {t.pagePath && <p className="mt-1 text-xs text-stone-400">{t.pagePath}</p>}

              {t.replies.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2 border-t border-stone-200 pt-3">
                  {t.replies.map((r) => (
                    <li key={r.id} className="text-sm">
                      <p className="text-xs font-medium text-stone-500">
                        {r.fromOperator ? "Freehold support" : r.authorEmail}
                        <span className="ml-1.5 font-normal text-stone-400">
                          {fmtDate(r.createdAt)}
                        </span>
                      </p>
                      <p className="whitespace-pre-wrap text-stone-700">{r.body}</p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
                <form action={addTicketReply} className="flex flex-1 gap-2">
                  <input type="hidden" name="ticketId" value={t.id} />
                  <input
                    name="body"
                    placeholder="Add a reply…"
                    required
                    className={`${input} flex-1`}
                  />
                  <PendingButton pendingLabel="Sending…" className={btn}>
                    Reply
                  </PendingButton>
                </form>
                <form action={setTicketStatusSelf}>
                  <input type="hidden" name="ticketId" value={t.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={t.status === "CLOSED" ? "OPEN" : "CLOSED"}
                  />
                  <button type="submit" className={`${btnGhost} px-2.5 py-1 text-xs`}>
                    {t.status === "CLOSED" ? "Reopen" : "Mark resolved"}
                  </button>
                </form>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
