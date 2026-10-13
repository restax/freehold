import { prisma } from "@freehold/db";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import {
  adminSendSetupOffer,
  adminSendSetupOfferToAll,
  adminSendSetupTest,
} from "@/lib/actions/setup-sessions";
import { isOperator, operatorEmails } from "@/lib/operator";
import { OUTREACH_EMAILS, SETUP_OFFER_KEY } from "@/lib/outreach-emails";
import { platformEmailEnabled } from "@/lib/platform-email";
import { slotFullLabel } from "@/lib/setup-sessions";
import { td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

/**
 * Operator view of the setup-session offer: who has been sent it, who has
 * booked, and the buttons to send. Flagged accounts and operators are left out.
 */
export default async function SetupAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ test?: string; to?: string; why?: string }>;
}) {
  if (!(await isOperator())) notFound();
  const { test, to, why } = await searchParams;
  const [users, invites, sends] = await Promise.all([
    prisma.user.findMany({
      where: { flaggedAt: null, email: { notIn: operatorEmails() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.setupInvite.findMany({ include: { bookings: { orderBy: { startsAt: "asc" } } } }),
    prisma.outreachSend.findMany({ select: { userId: true, emailKey: true, sentAt: true } }),
  ]);
  const sentAt = new Map(
    sends.filter((x) => x.emailKey === SETUP_OFFER_KEY).map((x) => [x.userId, x.sentAt]),
  );
  const sentCount = (key: string) => sends.filter((x) => x.emailKey === key).length;
  const byUser = new Map(invites.map((i) => [i.userId, i]));
  const pending = users.filter((u) => !sentAt.has(u.id)).length;
  const upcoming = invites
    .flatMap((i) => i.bookings.map((b) => ({ ...b, name: i.name, email: i.email })))
    .filter((b) => b.startsAt.getTime() > Date.now())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return (
    <div className="flex flex-col gap-4">
      {test === "ok" && (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Test sent to {to}. It can take a minute, and may land in spam or Promotions.
        </p>
      )}
      {test === "fail" && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          The test did not send: {why}
        </p>
      )}
      <SectionCard
        title="Upcoming setup sessions"
        count={upcoming.length}
        bodyClassName=""
        action={
          platformEmailEnabled() ? (
            <form action={adminSendSetupTest}>
              <button
                type="submit"
                className="rounded border border-stone-300 bg-white px-2 py-1 text-xs hover:bg-stone-50"
              >
                Send me a test
              </button>
            </form>
          ) : undefined
        }
      >
        {upcoming.length === 0 ? (
          <p className="px-4 py-3 text-sm text-stone-400">Nothing booked yet.</p>
        ) : (
          <table className="w-full text-left">
            <tbody>
              {upcoming.map((b) => (
                <tr key={b.id} className={trHover}>
                  <td className={td}>{slotFullLabel(b.startsAt)}</td>
                  <td className={td}>{b.name}</td>
                  <td className={`${td} text-stone-500`}>{b.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <SectionCard
        title="Email 1: Setup sessions offer"
        count={users.length}
        bodyClassName=""
        action={
          pending > 0 && platformEmailEnabled() ? (
            <details className="relative">
              <summary className="cursor-pointer rounded border border-stone-300 bg-white px-2 py-1 text-xs hover:bg-stone-50">
                Send to {pending} not yet invited
              </summary>
              <form
                action={adminSendSetupOfferToAll}
                className="absolute right-0 z-10 mt-1 flex w-60 flex-col gap-2 rounded border border-stone-200 bg-white p-3 shadow"
              >
                <span className="text-xs text-stone-600">
                  This emails {pending} {pending === 1 ? "person" : "people"} right away.
                </span>
                <button
                  type="submit"
                  className="w-fit rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700"
                >
                  Send now
                </button>
              </form>
            </details>
          ) : undefined
        }
      >
        {!platformEmailEnabled() && (
          <p className="border-b border-stone-100 px-4 py-2 text-xs text-amber-700">
            Platform email is not configured here, so nothing can be sent.
          </p>
        )}
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className={th}>Person</th>
              <th className={th}>Offer sent</th>
              <th className={th}>Sessions booked</th>
              <th className={th}>Send</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const inv = byUser.get(u.id);
              const at = sentAt.get(u.id);
              return (
                <tr key={u.id} className={trHover}>
                  <td className={td}>
                    <span className="font-medium">{u.name}</span>
                    <span className="ml-2 text-xs text-stone-400">{u.email}</span>
                  </td>
                  <td className={td}>
                    {at
                      ? at.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "Not yet"}
                  </td>
                  <td className={td}>{inv?.bookings.length ?? 0} of 6</td>
                  <td className={td}>
                    {at ? (
                      <details>
                        <summary className="w-fit cursor-pointer rounded border border-stone-300 px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-50">
                          Already sent
                        </summary>
                        <form action={adminSendSetupOffer} className="mt-1 flex flex-col gap-1">
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="again" value="1" />
                          <span className="max-w-48 text-xs text-stone-500">
                            They already have this email. Sending again replaces their link.
                          </span>
                          <button
                            type="submit"
                            disabled={!platformEmailEnabled()}
                            className="w-fit rounded border border-stone-300 px-1.5 py-0.5 text-xs hover:bg-stone-50 disabled:opacity-40"
                          >
                            Send again
                          </button>
                        </form>
                      </details>
                    ) : (
                      <form action={adminSendSetupOffer}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button
                          type="submit"
                          disabled={!platformEmailEnabled()}
                          className="rounded border border-stone-300 px-1.5 py-0.5 text-xs hover:bg-stone-50 disabled:opacity-40"
                        >
                          Send
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Emails" count={OUTREACH_EMAILS.length} bodyClassName="">
        <p className="border-b border-stone-100 px-4 py-2 text-xs text-stone-500">
          Each email goes to a person once. Emails 2 to 11 are empty slots for the ones we design
          next.
        </p>
        <table className="w-full text-left">
          <tbody>
            {OUTREACH_EMAILS.map((e) => (
              <tr key={e.key} className={trHover}>
                <td className={`${td} w-24 font-medium`}>Email {e.number}</td>
                <td className={e.status === "live" ? td : `${td} text-stone-400`}>{e.title}</td>
                <td className={`${td} text-right text-xs text-stone-500`}>
                  {e.status === "live"
                    ? `Sent to ${sentCount(e.key)} of ${users.length}`
                    : "Placeholder"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}
