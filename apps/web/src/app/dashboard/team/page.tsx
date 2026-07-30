import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { MemberHandbookNotes } from "@/components/handbook-notes";
import { SectionCard } from "@/components/section-card";
import { addLicense, deleteLicense } from "@/lib/actions/licenses";
import {
  cancelInvitation,
  inviteMember,
  removeMember,
  updateMemberBillingRole,
  updateMemberComplianceTier,
  updateMemberRole,
} from "@/lib/actions/team";
import { BILLING_ROLE_OPTIONS, billingRoleLabel } from "@/lib/billing-access";
import { fmtDate } from "@/lib/format";
import { licenseHealth } from "@/lib/licenses";
import { handbookState, seatState } from "@/lib/plans";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, btnGhost, input, label, tableWrap, td, th, trHover } from "@/lib/ui";

/** Dot color for a license chip: current / expiring / expired. */
const HEALTH_DOT = {
  ok: "bg-brand-600",
  expiring: "bg-amber-500",
  expired: "bg-red-500",
} as const;

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
  const [members, invitations, licenses] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId: tenantId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { organizationId: tenantId, status: "pending" },
      orderBy: { expiresAt: "desc" },
    }),
    withTenant(tenantId, (tx) =>
      tx.userLicense.findMany({ orderBy: [{ state: "asc" }, { createdAt: "asc" }] }),
    ),
  ]);
  // Notes about people, keyed by member. Only fetched for an admin — a plain
  // member must never receive these rows at all, not merely fail to render
  // them, so the query itself is behind the check rather than the markup.
  const hb = await handbookState(tenantId);
  const showMemberNotes = isAdmin && hb.notes;
  const memberNotes = showMemberNotes
    ? await withTenant(tenantId, (tx) =>
        tx.handbookNote.findMany({
          where: { subjectType: "MEMBER" },
          orderBy: { createdAt: "desc" },
        }),
      )
    : [];
  const notesByMember = new Map<string, typeof memberNotes>();
  for (const n of memberNotes) {
    const list = notesByMember.get(n.subjectId) ?? [];
    list.push(n);
    notesByMember.set(n.subjectId, list);
  }

  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const seats = await seatState(tenantId);
  const licensesByUser = new Map<string, typeof licenses>();
  for (const lic of licenses) {
    const list = licensesByUser.get(lic.userId) ?? [];
    list.push(lic);
    licensesByUser.set(lic.userId, list);
  }

  return (
    <div className="flex flex-col gap-4">
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

      <SectionCard title="Members">
        <div className={tableWrap}>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Email</th>
                <th className={th}>Licenses</th>
                <th className={th}>Role</th>
                <th className={th}>Compliance review</th>
                <th className={th}>Billing</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className={trHover}>
                  <td className={`${td} font-medium`}>
                    <span className="flex items-center gap-2">
                      <Avatar user={m.user} size={28} />
                      <span>
                        {m.user.name}
                        {m.userId === userId && (
                          <span className="ml-1 text-xs text-stone-400">(you)</span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className={td}>{m.user.email}</td>
                  <td className={td}>
                    {(licensesByUser.get(m.userId) ?? []).length === 0 ? (
                      <span className="text-stone-300">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {(licensesByUser.get(m.userId) ?? []).map((lic) => {
                          const health = licenseHealth(lic.expiresAt);
                          return (
                            <span
                              key={lic.id}
                              title={
                                lic.expiresAt
                                  ? `${health === "expired" ? "Expired" : "Expires"} ${fmtDate(lic.expiresAt)}`
                                  : "No expiry on record"
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-xs font-medium text-stone-700"
                            >
                              <span
                                aria-hidden
                                className={`h-1.5 w-1.5 rounded-full ${HEALTH_DOT[health]}`}
                              />
                              {lic.state}
                            </span>
                          );
                        })}
                      </span>
                    )}
                  </td>
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
                    {m.role === "owner" ? (
                      <span className="text-stone-500">Full authority</span>
                    ) : !isAdmin ? (
                      <span className="text-stone-500">
                        {billingRoleLabel(m.role, m.billingRole)}
                      </span>
                    ) : (
                      <form action={updateMemberBillingRole} className="flex items-center gap-1">
                        <input type="hidden" name="memberId" value={m.id} />
                        <select
                          name="billingRole"
                          defaultValue={m.billingRole ?? "default"}
                          className={`${input} px-2 py-1 text-xs`}
                        >
                          {BILLING_ROLE_OPTIONS.map(([value, text]) => (
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
        </div>
      </SectionCard>

      {showMemberNotes &&
        members.map((m) => (
          <MemberHandbookNotes
            key={`hb-${m.id}`}
            subjectId={m.id}
            personName={m.user.name ?? m.user.email}
            notes={notesByMember.get(m.id) ?? []}
            canWrite
            back="/dashboard/team"
          />
        ))}

      {isAdmin && (
        <SectionCard title="Team licenses">
          <p className="mb-3 text-sm text-stone-500">
            The workspace's record of who is licensed where — some states require a licensed
            coordinator on every file. Each person can also manage their own from their profile.
          </p>
          <form action={addLicense} className="mb-2 flex flex-wrap items-end gap-3">
            <label className={label}>
              Member *
              <select name="userId" required className={input} defaultValue="">
                <option value="" disabled>
                  — pick —
                </option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              State *
              <input
                name="state"
                required
                maxLength={2}
                className={`${input} w-20`}
                placeholder="TX"
              />
            </label>
            <label className={label}>
              Type
              <input name="label" className={input} placeholder="Salesperson" />
            </label>
            <label className={label}>
              License #
              <input name="licenseNumber" className={input} />
            </label>
            <label className={label}>
              Expires
              <input name="expiresAt" type="date" className={input} />
            </label>
            <label className={`${label} min-w-52`}>
              Copy (optional)
              <input
                name="file"
                type="file"
                accept="application/pdf,.pdf,image/*"
                className={input}
              />
            </label>
            <button type="submit" className={btn}>
              Add license
            </button>
          </form>
          {licenses.length > 0 && (
            <ul className="flex flex-col">
              {licenses.map((lic) => {
                const owner = members.find((m) => m.userId === lic.userId);
                const health = licenseHealth(lic.expiresAt);
                return (
                  <li
                    key={lic.id}
                    className="flex flex-wrap items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                  >
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${HEALTH_DOT[health]}`}
                    />
                    <span className="font-medium">{lic.state}</span>
                    <span className="text-stone-600">{owner?.user.name ?? "(former member)"}</span>
                    <span className="text-xs text-stone-400">
                      {lic.label ?? "License"}
                      {lic.licenseNumber ? ` #${lic.licenseNumber}` : ""}
                      {lic.expiresAt
                        ? ` · ${health === "expired" ? "expired" : "expires"} ${fmtDate(lic.expiresAt)}`
                        : ""}
                    </span>
                    {lic.filename && (
                      <a
                        href={`/api/licenses/${lic.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-600 hover:underline"
                      >
                        open copy
                      </a>
                    )}
                    <form action={deleteLicense} className="ml-auto">
                      <input type="hidden" name="id" value={lic.id} />
                      <button type="submit" className="text-xs text-stone-300 hover:text-red-600">
                        remove
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      )}

      {isAdmin && (
        <SectionCard title="Invite a teammate">
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
        </SectionCard>
      )}
    </div>
  );
}
