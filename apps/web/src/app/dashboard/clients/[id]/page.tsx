import { withTenant } from "@freehold/db";
import { Buildings, LinkSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/badges";
import { DangerDelete } from "@/components/danger-delete";
import { deleteClient } from "@/lib/actions/clients";
import { setPortalLinkActive } from "@/lib/actions/portal";
import { fmtDate, fmtMoney } from "@/lib/format";
import { portalOrigin } from "@/lib/portal";
import { requireAdminTenant } from "@/lib/tenant";
import { btnGhost, card, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  AGENT: "Agent",
  BROKERAGE: "Brokerage",
  TITLE: "Title company",
  LENDER: "Lender",
  OTHER: "Other",
};

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const { id } = await params;

  const client = await withTenant(tenantId, (tx) =>
    tx.client.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { updatedAt: "desc" },
          include: { portalLinks: { orderBy: { createdAt: "desc" } } },
        },
      },
    }),
  );
  if (!client) notFound();
  const portalBase = await portalOrigin(tenantId);

  const portalLinks = client.transactions.flatMap((t) =>
    t.portalLinks.map((pl) => ({ ...pl, transaction: t })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/dashboard/clients" className="text-sm text-stone-500 hover:underline">
          ← Clients
        </Link>
        <h1 className="flex items-center gap-2.5 text-xl font-semibold">
          <Buildings size={20} weight="duotone" className="text-brand-600" aria-hidden />
          {client.name}
        </h1>
        <p className="text-sm text-stone-500">
          {TYPE_LABEL[client.type]}
          {client.email ? ` · ${client.email}` : ""}
          {client.phone ? ` · ${client.phone}` : ""}
        </p>
      </div>

      <section className={card}>
        <h2 className="mb-3 font-medium">Transactions</h2>
        {client.transactions.length === 0 ? (
          <p className="text-sm text-stone-500">
            No transactions for this client yet.{" "}
            <Link href="/dashboard/transactions" className="text-brand-700 hover:underline">
              Create one →
            </Link>
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Property</th>
                <th className={th}>Status</th>
                <th className={th}>Price</th>
                <th className={th}>Close date</th>
              </tr>
            </thead>
            <tbody>
              {client.transactions.map((t) => (
                <tr key={t.id} className={trHover}>
                  <td className={td}>
                    <Link
                      href={`/dashboard/transactions/${t.id}`}
                      className="font-medium text-brand-700 hover:text-brand-600"
                    >
                      {t.propertyAddress}
                    </Link>
                  </td>
                  <td className={td}>
                    <StatusBadge status={t.status} />
                  </td>
                  <td className={td}>{fmtMoney(t.purchasePrice)}</td>
                  <td className={td}>{fmtDate(t.closeDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-1 flex items-center gap-2 font-medium">
          <LinkSimple size={17} weight="bold" className="text-brand-600" aria-hidden />
          Portal access
        </h2>
        <p className="mb-3 text-sm text-stone-500">
          Everyone with a portal sign-in for this client's transactions. Deactivating a link shuts
          it off instantly — the same link works again if you reactivate.
        </p>
        {portalLinks.length === 0 ? (
          <p className="text-sm text-stone-500">
            No portal links yet. Create them from a transaction's page.
          </p>
        ) : (
          <ul className="flex flex-col">
            {portalLinks.map((pl) => {
              const active = !pl.revokedAt;
              return (
                <li
                  key={pl.id}
                  className="flex flex-wrap items-center gap-3 border-b border-stone-100 py-2.5 last:border-0"
                >
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                      active ? "bg-brand-50 text-brand-800" : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${active ? "bg-brand-500" : "bg-stone-400"}`}
                    />
                    {active ? "Active" : "Inactive"}
                  </span>
                  <span className="text-sm font-medium">{pl.label}</span>
                  <Link
                    href={`/dashboard/transactions/${pl.transaction.id}`}
                    className="text-sm text-stone-500 hover:text-brand-700 hover:underline"
                  >
                    {pl.transaction.propertyAddress}
                  </Link>
                  {pl.lastAccessedAt && (
                    <span className="text-xs text-stone-400">
                      last opened {fmtDate(pl.lastAccessedAt)}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {active && (
                      <span className="max-w-48 truncate font-mono text-xs text-stone-400">
                        {portalBase}/portal/{pl.token}
                      </span>
                    )}
                    <form action={setPortalLinkActive}>
                      <input type="hidden" name="id" value={pl.id} />
                      <input type="hidden" name="active" value={active ? "0" : "1"} />
                      <button type="submit" className={`${btnGhost} px-2.5 py-1 text-xs`}>
                        {active ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isAdmin && (
        <DangerDelete
          action={deleteClient}
          label="Delete this client"
          description={`Removes ${client.name} and unlinks their transactions (the transactions themselves are kept). This cannot be undone.`}
          hidden={{ id: client.id }}
        />
      )}
    </div>
  );
}
