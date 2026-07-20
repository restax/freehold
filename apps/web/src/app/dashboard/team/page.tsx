import { prisma } from "@freehold/db";
import Link from "next/link";
import {
  cancelInvitation,
  inviteMember,
  removeMember,
  updateMemberComplianceTier,
  updateMemberRole,
} from "@/lib/actions/team";
import { fmtDate } from "@/lib/format";
import { seatState } from "@/lib/plans";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, btnGhost, card, input, label, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const ROLES = ["admin", "member"] as const;

const TIER_OPTIONS = [
  ["default", "Default (by role)"],
  ["0", "Submitter only"],
  ["1", "Level 1 reviewer"],
  ["2", "Level 2 reviewer"],
  ["3", "Level 3 reviewer"],
] as const;

const tierLabel = (t: number | null, role: string) =>
  t === null
    ? role === "member"
      ? "Submits (default)"
      : "Reviews (default)"
    : t === 0
      ? "Submitter only"
      : `Level ${t} reviewer`;

export default async function TeamPage() {
  const { tenantId, userId, isAdmin } = await requireAdminTenant();
  const [members, invitations] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId: tenantId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { organizationId: tenantId, status: "pending" },
      orderBy: { expiresAt: "desc" },
    }),
  ]);
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const seats = await seatState(tenantId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="text-sm text-stone-500">
          Owners and admins manage the workspace; members handle day-to-day coordination but can't
          delete transactions, clients, templates, or plans. Compliance review sets who can approve
          submitted documents, and at which level when a checklist needs more than one sign-off.
        </p>
      </div>

      {seats.limited && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          All {seats.limit} seats are in use (members + pending invitations).{" "}
          <Link href="/dashboard/billing" className="font-medium text-brand-700 underline">
            Add seats
          </Link>{" "}
          to invite more teammates.
        </p>
      )}

      <section className={card}>
        <h2 className="mb-3 font-medium">Members</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Email</th>
              <th className={th}>Role</th>
              <th className={th}>Compliance review</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className={trHover}>
                <td className={`${td} font-medium`}>
                  {m.user.name}
                  {m.userId === userId && (
                    <span className="ml-1 text-xs text-stone-400">(you)</span>
                  )}
                </td>
                <td className={td}>{m.user.email}</td>
                <td className={td}>
                  {m.role === "owner" || !isAdmin ? (
                    <span className="capitalize">{m.role}</span>
                  ) : (
                    <form action={updateMemberRole} className="flex items-center gap-1">
                      <input type="hidden" name="memberId" value={m.id} />
                      <select
                        name="role"
                        defaultValue={m.role}
                        className={`${input} px-2 py-1 text-xs`}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                        Save
                      </button>
                    </form>
                  )}
                </td>
                <td className={td}>
                  {m.role === "owner" ? (
                    <span className="text-stone-500">Full authority</span>
                  ) : !isAdmin ? (
                    <span className="text-stone-500">{tierLabel(m.complianceTier, m.role)}</span>
                  ) : (
                    <form action={updateMemberComplianceTier} className="flex items-center gap-1">
                      <input type="hidden" name="memberId" value={m.id} />
                      <select
                        name="complianceTier"
                        defaultValue={
                          m.complianceTier === null ? "default" : String(m.complianceTier)
                        }
                        className={`${input} px-2 py-1 text-xs`}
                      >
                        {TIER_OPTIONS.map(([value, text]) => (
                          <option key={value} value={value}>
                            {text}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                        Save
                      </button>
                    </form>
                  )}
                </td>
                <td className={td}>
                  {isAdmin && m.role !== "owner" && m.userId !== userId && (
                    <form action={removeMember}>
                      <input type="hidden" name="memberId" value={m.id} />
                      <button type="submit" className="text-xs text-stone-300 hover:text-red-600">
                        remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {isAdmin && (
        <section className={card}>
          <h2 className="mb-3 font-medium">Invite a teammate</h2>
          <form action={inviteMember} className="flex flex-wrap items-end gap-3">
            <label className={label}>
              Email *
              <input name="email" type="email" required className={input} />
            </label>
            <label className={label}>
              Role
              <select name="role" className={input} defaultValue="member">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={btn}>
              Create invitation
            </button>
          </form>
          {invitations.length > 0 && (
            <ul className="mt-4 flex flex-col">
              {invitations.map((inv) => (
                <li key={inv.id} className="border-b border-stone-100 py-2 last:border-0">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-medium">{inv.email}</span>
                    <span className="text-xs text-stone-400">
                      {inv.role} · expires {fmtDate(inv.expiresAt)}
                    </span>
                    <form action={cancelInvitation} className="ml-auto">
                      <input type="hidden" name="id" value={inv.id} />
                      <button type="submit" className="text-xs text-stone-300 hover:text-red-600">
                        cancel
                      </button>
                    </form>
                  </div>
                  <input
                    readOnly
                    value={`${baseUrl}/accept-invitation/${inv.id}`}
                    className="mt-1 w-full rounded border border-stone-200 bg-stone-50 px-2 py-1 font-mono text-xs text-stone-600"
                  />
                  <p className="mt-0.5 text-xs text-stone-400">
                    Send this link to {inv.email} — they sign up with that email, then accept.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
