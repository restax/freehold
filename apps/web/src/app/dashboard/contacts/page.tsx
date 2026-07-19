import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { GRADE_CADENCE } from "@/lib/crm";
import { fmtDate } from "@/lib/format";
import { getMemberRole, requireTenant } from "@/lib/tenant";
import { btn, card, input, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; q?: string; due?: string }>;
}) {
  const { tenantId, userId } = await requireTenant();
  const { owner, q, due } = await searchParams;

  const [org, role, members] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { restrictContactsToOwner: true },
    }),
    getMemberRole(tenantId, userId),
    prisma.member.findMany({
      where: { organizationId: tenantId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  // Admin restriction: members see only their own contacts when enabled.
  const restricted = org.restrictContactsToOwner && role === "member";
  const today = new Date();

  const contacts = await withTenant(tenantId, (tx) =>
    tx.contact.findMany({
      where: {
        ...(restricted ? { ownerId: userId } : {}),
        ...(owner === "me" ? { ownerId: userId } : owner ? { ownerId: owner } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { company: { contains: q, mode: "insensitive" } },
                { categories: { has: q } },
              ],
            }
          : {}),
        ...(due ? { nextTouchAt: { lte: today } } : {}),
      },
      orderBy: [{ nextTouchAt: { sort: "asc", nulls: "last" } }, { name: "asc" }],
      include: { owner: { select: { name: true } }, _count: { select: { parties: true } } },
    }),
  );

  const dueCount = await withTenant(tenantId, (tx) =>
    tx.contact.count({
      where: { ...(restricted ? { ownerId: userId } : {}), nextTouchAt: { lte: today } },
    }),
  );
  const todayKey = fmtDate(today);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Contacts</h1>
          <p className="text-sm text-stone-500">
            Your CRM — one record can hold a couple or a client and their assistant.
            {restricted && " Showing only contacts you own (workspace policy)."}
          </p>
        </div>
        <Link href="/dashboard/contacts/new" className={btn}>
          + New contact
        </Link>
      </div>

      <form method="GET" className={`${card} flex flex-wrap items-end gap-3`}>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-stone-700">
          Search
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name, email, company, or category…"
            className={input}
          />
        </label>
        {!restricted && (
          <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
            Owner
            <select name="owner" defaultValue={owner ?? ""} className={input}>
              <option value="">Everyone</option>
              <option value="me">Mine</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 pb-2 text-sm text-stone-700">
          <input
            type="checkbox"
            name="due"
            value="1"
            defaultChecked={Boolean(due)}
            className="h-4 w-4 accent-brand-600"
          />
          Due for a touch ({dueCount})
        </label>
        <button
          type="submit"
          className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
        >
          Filter
        </button>
      </form>

      <section className={card}>
        {contacts.length === 0 ? (
          <EmptyState
            title="No contacts match"
            hint="Contacts are the people in your world — clients, agents, lenders, inspectors. One record can hold two related people for mailings and merges."
          >
            <Link
              href="/dashboard/contacts/new"
              className="text-sm font-medium text-brand-700 hover:text-brand-600"
            >
              Create a contact →
            </Link>
          </EmptyState>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Categories</th>
                <th className={th}>Grade</th>
                <th className={th}>Next touch</th>
                <th className={th}>Owner</th>
                <th className={th}>Deals</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const dueNow = c.nextTouchAt && fmtDate(c.nextTouchAt) <= todayKey;
                return (
                  <tr key={c.id} className={trHover}>
                    <td className={td}>
                      <Link
                        href={`/dashboard/contacts/${c.id}`}
                        className="font-medium text-brand-700 hover:text-brand-600"
                      >
                        {c.name}
                      </Link>
                      {c.company && (
                        <span className="ml-2 text-xs text-stone-400">{c.company}</span>
                      )}
                    </td>
                    <td className={td}>
                      <span className="flex flex-wrap gap-1">
                        {c.categories.slice(0, 3).map((cat) => (
                          <span
                            key={cat}
                            className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
                          >
                            {cat}
                          </span>
                        ))}
                        {c.categories.length > 3 && (
                          <span className="text-xs text-stone-400">+{c.categories.length - 3}</span>
                        )}
                      </span>
                    </td>
                    <td className={td}>
                      {c.grade ? (
                        <span
                          className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800"
                          title={`Auto-prospect every ${GRADE_CADENCE[c.grade]} days`}
                        >
                          {c.grade}
                        </span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className={td}>
                      <span className={dueNow ? "font-medium text-amber-700" : ""}>
                        {fmtDate(c.nextTouchAt)}
                      </span>
                    </td>
                    <td className={td}>{c.owner?.name ?? "—"}</td>
                    <td className={td}>{c._count.parties}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
