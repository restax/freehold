import { withTenant } from "@freehold/db";
import { after } from "next/server";
import { TicketBadge } from "@/components/badges";
import { addTicketReply } from "@/lib/actions/support";
import { fmtDate } from "@/lib/format";
import { markSupportSeen } from "@/lib/support-unread";
import { getMemberRole, requireTenant } from "@/lib/tenant";
import { btn, card, input } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const { tenantId, userId } = await requireTenant({ allowGuest: true });
  const role = await getMemberRole(tenantId, userId);
  const isAdmin = role === "owner" || role === "admin";

  // Opening the page marks everything currently here as seen — clears the
  // sidebar badge, and (on a poll-driven refresh) re-marks after a new reply.
  after(() => markSupportSeen(tenantId, userId));

  const tickets = await withTenant(tenantId, (tx) =>
    tx.supportTicket.findMany({
      where: isAdmin ? {} : { userId },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        user: { select: { name: true, email: true } },
        replies: { orderBy: { createdAt: "asc" } },
      },
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-stone-500">
          {isAdmin ? "Every ticket from your workspace" : "Tickets you've filed"}
        </p>
        <h1 className="text-xl font-semibold">Support</h1>
      </div>

      {tickets.length === 0 ? (
        <p className="text-sm text-stone-400">
          Nothing yet. "Report an issue" is at the bottom of the sidebar any time.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {tickets.map((t) => (
            <section key={t.id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-stone-400">
                    {isAdmin && t.user ? `${t.user.name} · ` : ""}
                    {fmtDate(t.createdAt)}
                    {t.pagePath ? ` · ${t.pagePath}` : ""}
                  </p>
                </div>
                <TicketBadge status={t.status} />
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-stone-700">{t.body}</p>

              {t.replies.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2 border-t border-stone-100 pt-3">
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

              <form
                action={addTicketReply}
                className="mt-3 flex flex-col gap-2 border-t border-stone-100 pt-3 sm:flex-row"
              >
                <input type="hidden" name="ticketId" value={t.id} />
                <input
                  name="body"
                  placeholder="Add a reply…"
                  required
                  className={`${input} flex-1`}
                />
                <button type="submit" className={btn}>
                  Reply
                </button>
              </form>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
