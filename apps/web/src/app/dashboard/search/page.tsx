import { withTenant } from "@freehold/db";
import { AddressBook, Buildings, House } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { fmtDate, STATUS_LABEL } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const PER_KIND = 25;

/**
 * One search box over everything a coordinator looks for by name.
 *
 * Three separate queries rather than one clever union: each kind wants a
 * different set of fields matched and a different row, and three indexed
 * `contains` queries against a workspace's data are cheap. Results are grouped
 * by kind because "which of these is the transaction" is the first question
 * you'd otherwise have to answer yourself.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const q = ((await searchParams).q ?? "").trim();

  const like = { contains: q, mode: "insensitive" as const };

  const { transactions, contacts, clients } = q
    ? await withTenant(tenantId, async (tx) => ({
        transactions: await tx.transaction.findMany({
          where: {
            OR: [
              { propertyAddress: like },
              { city: like },
              { mlsId: like },
              { client: { name: like } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: PER_KIND,
          select: {
            id: true,
            propertyAddress: true,
            city: true,
            state: true,
            status: true,
            closeDate: true,
          },
        }),
        contacts: await tx.contact.findMany({
          where: {
            OR: [
              { name: like },
              { company: like },
              { email: like },
              // The second person on the record, lowercased and indexed.
              { secondarySearch: { contains: q.toLowerCase() } },
            ],
          },
          orderBy: { name: "asc" },
          take: PER_KIND,
          select: { id: true, name: true, company: true, email: true },
        }),
        clients: await tx.client.findMany({
          where: { OR: [{ name: like }, { email: like }] },
          orderBy: { name: "asc" },
          take: PER_KIND,
          select: { id: true, name: true, type: true, email: true },
        }),
      }))
    : { transactions: [], contacts: [], clients: [] };

  const total = transactions.length + contacts.length + clients.length;
  const rowCls =
    "flex items-baseline justify-between gap-3 border-b border-stone-100 px-4 py-2.5 text-sm last:border-0 hover:bg-stone-50";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{q ? <>Results for “{q}”</> : "Search"}</h1>
        {q && (
          <p className="text-sm text-stone-500">
            {total} {total === 1 ? "match" : "matches"}
            {total >= PER_KIND ? " (showing the most recent of each)" : ""}
          </p>
        )}
      </div>

      {!q ? (
        <EmptyState
          title="Search your workspace"
          hint="Type in the box at the top to find a transaction by address, city or MLS number, a contact by either person's name or email, or a client by name."
        />
      ) : total === 0 ? (
        <EmptyState
          title={`Nothing matches “${q}”`}
          hint="Try a shorter piece of the address or name — matching is on any part of the text, not just the start."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          <SectionCard
            title="Transactions"
            count={transactions.length}
            icon={<House size={15} weight="fill" aria-hidden />}
            bodyClassName=""
          >
            {transactions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-stone-400">No transactions match.</p>
            ) : (
              transactions.map((t) => (
                <Link key={t.id} href={`/dashboard/transactions/${t.id}`} className={rowCls}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-brand-700">
                      {t.propertyAddress}
                    </span>
                    <span className="block truncate text-xs text-stone-400">
                      {[t.city, t.state].filter(Boolean).join(", ") || "—"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-stone-500">
                    <span className="block">{STATUS_LABEL[t.status] ?? t.status}</span>
                    <span className="block text-stone-400">
                      {t.closeDate ? fmtDate(t.closeDate) : ""}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </SectionCard>

          <SectionCard
            title="Contacts"
            count={contacts.length}
            icon={<AddressBook size={15} weight="fill" aria-hidden />}
            bodyClassName=""
          >
            {contacts.length === 0 ? (
              <p className="px-4 py-3 text-sm text-stone-400">No contacts match.</p>
            ) : (
              contacts.map((c) => (
                <Link key={c.id} href={`/dashboard/contacts/${c.id}`} className={rowCls}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-brand-700">{c.name}</span>
                    <span className="block truncate text-xs text-stone-400">
                      {c.company || c.email || "—"}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </SectionCard>

          <SectionCard
            title="Clients"
            count={clients.length}
            icon={<Buildings size={15} weight="fill" aria-hidden />}
            bodyClassName=""
          >
            {clients.length === 0 ? (
              <p className="px-4 py-3 text-sm text-stone-400">No clients match.</p>
            ) : (
              clients.map((c) => (
                <Link key={c.id} href={`/dashboard/clients/${c.id}`} className={rowCls}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-brand-700">{c.name}</span>
                    <span className="block truncate text-xs text-stone-400">
                      {c.email || c.type}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
