import { prisma } from "@freehold/db";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { sendRecommendationFromAdmin } from "@/lib/actions/recommend-admin";
import { isOperator } from "@/lib/operator";
import { twentyStatus } from "@/lib/twenty";
import { btn, input, label, tableWrap, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const CRM_SOURCE_ORG_SLUG = "acme-brokers-inc";

const SEND_ERROR: Record<string, string> = {
  invalid: "That doesn't look like a valid email address.",
  unavailable: "Sending isn't configured on this instance right now.",
  send: "The email didn't go out. Try again in a moment.",
};

/**
 * Every "recommend Freehold" send, from the public /recommend form and from
 * the composer below, plus whether the recipient ever opened the tracked
 * link and whether the lead made it into Twenty CRM.
 */
export default async function AdminRecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  if (!(await isOperator())) notFound();
  const { sent, error } = await searchParams;

  const [rows, crmOrg] = await Promise.all([
    prisma.friendRecommendation.findMany({ orderBy: { sentAt: "desc" }, take: 500 }),
    prisma.organization.findFirst({ where: { slug: CRM_SOURCE_ORG_SLUG }, select: { id: true } }),
  ]);
  const crm = crmOrg ? await twentyStatus(crmOrg.id) : { connected: false };
  const clicked = rows.filter((r) => r.clickedAt).length;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Recommendations</h1>
        <p className="text-sm text-stone-500">
          Every "recommend Freehold" email sent, from the public form and from here.{" "}
          {rows.length > 0 && `${clicked} of ${rows.length} opened the link.`}
        </p>
      </div>

      <SectionCard
        title="Send a recommendation"
        icon={<PaperPlaneTilt size={15} weight="fill" aria-hidden />}
        bodyClassName="p-4 flex flex-col gap-3"
      >
        <p className="text-sm text-stone-500">
          Sends the same email the public form does.{" "}
          {crm.connected ? (
            <>
              If a name is given, the lead is also saved to Twenty CRM (<code>{crm.url}</code>) as a
              new person, with the note attached if you write one.
            </>
          ) : (
            <>
              Twenty CRM isn't connected on <code>{CRM_SOURCE_ORG_SLUG}</code>'s workspace right
              now, so this will only send the email.
            </>
          )}
        </p>
        <form
          action={sendRecommendationFromAdmin}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <label className={label}>
            Name
            <input name="name" className={input} placeholder="Jordan Lee" />
          </label>
          <label className={label}>
            Email
            <input
              name="email"
              type="email"
              required
              className={input}
              placeholder="jordan@example.com"
            />
          </label>
          <label className={label}>
            Phone
            <input name="phone" type="tel" className={input} placeholder="Optional" />
          </label>
          <label className={label}>
            Note
            <input
              name="note"
              className={input}
              placeholder="Optional — saved to Twenty, not the email"
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className={btn}>
              Send
            </button>
          </div>
        </form>
        {sent === "1" && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
            Sent.
          </p>
        )}
        {error && (
          <p className="text-sm text-red-700">{SEND_ERROR[error] ?? "Something went wrong."}</p>
        )}
      </SectionCard>

      {rows.length === 0 ? (
        <p className="text-sm text-stone-400">Nothing sent yet.</p>
      ) : (
        <div className={tableWrap}>
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Sent to</th>
                <th className={th}>Sent</th>
                <th className={th}>Clicked</th>
                <th className={th}>CRM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={trHover}>
                  <td className={td}>{r.name ?? <span className="text-stone-300">—</span>}</td>
                  <td className={td}>{r.email}</td>
                  <td className={td}>{r.sentAt.toLocaleString()}</td>
                  <td className={td}>
                    {r.clickedAt ? (
                      <span className="text-stone-700">{r.clickedAt.toLocaleString()}</span>
                    ) : (
                      <span className="text-stone-300">Not yet</span>
                    )}
                  </td>
                  <td className={td}>
                    {r.crmSyncedAt ? (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
                        Synced
                      </span>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
