import { EngagementStatus, prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { acceptEngagement, declineEngagement, endEngagement } from "@/lib/actions/engagements";
import { fmtDate } from "@/lib/format";
import { requireAdminTenant } from "@/lib/tenant";
import { btnGhost, card, input, label } from "@/lib/ui";

export const dynamic = "force-dynamic";

const TONE: Record<string, BadgeTone> = {
  REQUESTED: "progress",
  ACTIVE: "success",
  DECLINED: "neutral",
  ENDED: "neutral",
};

const STATUS_TEXT: Record<string, string> = {
  REQUESTED: "Awaiting response",
  ACTIVE: "Active",
  DECLINED: "Declined",
  ENDED: "Ended",
};

export default async function EngagementsPage() {
  const { tenantId, isAdmin } = await requireAdminTenant();

  // The RLS policy on engagement matches either party, so one query returns
  // both the coverage we've asked for and the coverage we've been asked to give.
  const rows = await withTenant(tenantId, (tx) =>
    tx.engagement.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        tenant: { select: { id: true, name: true } },
        vendorTenant: { select: { id: true, name: true } },
        guestUser: { select: { name: true, email: true } },
      },
    }),
  );
  const hiring = rows.filter((r) => r.tenantId === tenantId);
  const providing = rows.filter((r) => r.vendorTenantId === tenantId);

  // Who we could put on an incoming request — our own people, guests excluded.
  const ourMembers = await prisma.member.findMany({
    where: { organizationId: tenantId, role: { not: "guest" } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Engagements</h1>
        <p className="text-sm text-stone-500">
          Coverage arrangements with other Freehold workspaces — files you've asked someone to
          cover, and files you're covering for others. Whoever covers a file joins that workspace as
          a guest and sees only the files they're assigned.{" "}
          <Link href="/dashboard/directory" className="text-brand-700 hover:underline">
            Find coverage →
          </Link>
        </p>
      </div>

      <section className={card}>
        <h2 className="mb-1 font-medium">Coverage you've asked for</h2>
        <p className="mb-3 text-sm text-stone-500">
          Once they accept, assign their person to a file like any other teammate — from the file's
          Participants tab.
        </p>
        {hiring.length === 0 ? (
          <EmptyState
            title="You haven't engaged anyone"
            hint="Browse the directory for a workspace that covers your states."
          />
        ) : (
          <ul className="flex flex-col">
            {hiring.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
              >
                <Badge tone={TONE[e.status]}>{STATUS_TEXT[e.status]}</Badge>
                <span className="font-medium">{e.vendorTenant.name}</span>
                {e.guestUser && (
                  <span className="text-stone-500">
                    {e.guestUser.name} ({e.guestUser.email})
                  </span>
                )}
                <span className="text-xs text-stone-400">
                  asked {fmtDate(e.createdAt)}
                  {e.endedAt ? ` · ended ${fmtDate(e.endedAt)}` : ""}
                </span>
                {e.note && <span className="text-xs text-stone-500">“{e.note}”</span>}
                {isAdmin && e.status === EngagementStatus.ACTIVE && (
                  <form action={endEngagement} className="ml-auto">
                    <input type="hidden" name="id" value={e.id} />
                    <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                      end &amp; revoke access
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-1 font-medium">Coverage you've been asked to provide</h2>
        <p className="mb-3 text-sm text-stone-500">
          Accepting puts one of your people into their workspace as a guest, working their files
          there. Your own workspace is unaffected.
        </p>
        {providing.length === 0 ? (
          <p className="text-sm text-stone-400">
            Nobody has asked yet. Workspaces find you through the directory — list yourself in
            Settings.
          </p>
        ) : (
          <ul className="flex flex-col">
            {providing.map((e) => (
              <li key={e.id} className="border-b border-stone-100 py-2 last:border-0">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Badge tone={TONE[e.status]}>{STATUS_TEXT[e.status]}</Badge>
                  <span className="font-medium">{e.tenant.name}</span>
                  {e.guestUser && (
                    <span className="text-stone-500">{e.guestUser.name} covering</span>
                  )}
                  <span className="text-xs text-stone-400">asked {fmtDate(e.createdAt)}</span>
                  {isAdmin && e.status === EngagementStatus.ACTIVE && (
                    <form action={endEngagement} className="ml-auto">
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                        end
                      </button>
                    </form>
                  )}
                </div>
                {e.note && <p className="mt-1 text-xs text-stone-500">“{e.note}”</p>}
                {isAdmin && e.status === EngagementStatus.REQUESTED && (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <form action={acceptEngagement} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={e.id} />
                      <label className={label}>
                        Who will cover it
                        <select name="guestUserId" required defaultValue="" className={input}>
                          <option value="" disabled>
                            Choose…
                          </option>
                          {ourMembers.map((m) => (
                            <option key={m.user.id} value={m.user.id}>
                              {m.user.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit" className={btnGhost}>
                        Accept
                      </button>
                    </form>
                    <form action={declineEngagement}>
                      <input type="hidden" name="id" value={e.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-50"
                      >
                        Decline
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
