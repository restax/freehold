import { prisma, withTenant } from "@freehold/db";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { fmtDayMonth } from "@/lib/format";
import { isOperator } from "@/lib/operator";
import { PLAN_INFO } from "@/lib/plans";
import { td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const DAY = 24 * 3600 * 1000;

interface WorkspaceActivity {
  transactions: number;
  clients: number;
  contacts: number;
  documents: number;
  actions: number;
  lastAction: Date | null;
}

const EMPTY: WorkspaceActivity = {
  transactions: 0,
  clients: 0,
  contacts: 0,
  documents: 0,
  actions: 0,
  lastAction: null,
};

/** "3h ago" / "2d ago" for a moment in the recent past; a date beyond a month. */
function ago(d: Date | null | undefined): string {
  if (!d) return "never";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days <= 30 ? `${days}d ago` : fmtDayMonth(d);
}

/**
 * Operator view of new accounts and what they have done since joining.
 * User, session and organization tables carry no RLS (cross-tenant by design);
 * the per-workspace counts run through withTenant like every other tenant read.
 * `?q=` narrows to an email or name fragment.
 */
export default async function SignupsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await isOperator())) notFound();
  const q = ((await searchParams).q ?? "").trim();

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : { createdAt: { gte: new Date(Date.now() - 60 * DAY) } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      createdAt: true,
      members: {
        select: {
          role: true,
          organization: { select: { id: true, name: true, slug: true, planTier: true } },
        },
      },
      sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
      _count: { select: { sessions: true } },
    },
  });

  const orgIds = [...new Set(users.flatMap((u) => u.members.map((m) => m.organization.id)))];
  const activity = new Map<string, WorkspaceActivity>();
  await Promise.all(
    orgIds.map(async (id) => {
      const a = await withTenant(id, async (tx) => {
        const [transactions, clients, contacts, documents, actions, last] = await Promise.all([
          tx.transaction.count(),
          tx.client.count(),
          tx.contact.count(),
          tx.document.count(),
          tx.transactionActivity.count(),
          tx.transactionActivity.findFirst({
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
        ]);
        return {
          transactions,
          clients,
          contacts,
          documents,
          actions,
          lastAction: last?.createdAt ?? null,
        };
      }).catch(() => EMPTY);
      activity.set(id, a);
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Signups"
        count={users.length}
        action={
          <form method="get" className="flex items-center gap-1.5">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search email or name"
              className="w-56 rounded border border-stone-300 px-2 py-1 text-xs focus:border-brand-600 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-50"
            >
              Search
            </button>
          </form>
        }
        bodyClassName=""
      >
        <p className="border-b border-stone-100 px-4 py-2 text-xs text-stone-500">
          {q
            ? `Accounts matching "${q}", newest first.`
            : "Accounts created in the last 60 days, newest first."}{" "}
          Counts are for the person's workspace, so a teammate's work is included.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className={th}>Person</th>
                <th className={th}>Workspace</th>
                <th className={th}>Joined</th>
                <th className={th}>Last seen</th>
                <th className={th}>Sign-ins</th>
                <th className={th}>Transactions</th>
                <th className={th}>Clients</th>
                <th className={th}>Contacts</th>
                <th className={th}>Files</th>
                <th className={th}>Actions</th>
                <th className={th}>Last action</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td className={`${td} text-stone-400`} colSpan={11}>
                    {q ? "No account matches that search." : "No signups in the last 60 days."}
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const orgs = u.members.map((m) => m.organization);
                const totals = orgs.reduce(
                  (sum, o) => {
                    const a = activity.get(o.id) ?? EMPTY;
                    return {
                      transactions: sum.transactions + a.transactions,
                      clients: sum.clients + a.clients,
                      contacts: sum.contacts + a.contacts,
                      documents: sum.documents + a.documents,
                      actions: sum.actions + a.actions,
                      lastAction:
                        a.lastAction && (!sum.lastAction || a.lastAction > sum.lastAction)
                          ? a.lastAction
                          : sum.lastAction,
                    };
                  },
                  { ...EMPTY },
                );
                return (
                  <tr key={u.id} className={trHover}>
                    <td className={td}>
                      <span className="font-medium">{u.name}</span>
                      <span className="ml-2 text-xs text-stone-400">{u.email}</span>
                      {!u.emailVerified && (
                        <span className="ml-1.5 rounded bg-amber-100 px-1 text-xs text-amber-700">
                          unverified
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      {orgs.length === 0 ? (
                        <span className="text-stone-300">none yet</span>
                      ) : (
                        orgs.map((o) => (
                          <span key={o.id} className="mr-2">
                            {o.name}{" "}
                            <span className="text-xs text-stone-400">
                              {PLAN_INFO[o.planTier].label}
                            </span>
                          </span>
                        ))
                      )}
                    </td>
                    <td className={td}>{fmtDayMonth(u.createdAt)}</td>
                    <td className={td}>{ago(u.sessions[0]?.updatedAt)}</td>
                    <td className={td}>{u._count.sessions}</td>
                    <td className={td}>{totals.transactions}</td>
                    <td className={td}>{totals.clients}</td>
                    <td className={td}>{totals.contacts}</td>
                    <td className={td}>{totals.documents}</td>
                    <td className={td}>{totals.actions}</td>
                    <td className={td}>{ago(totals.lastAction)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
