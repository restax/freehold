import { ClientType, EsignProvider, withTenant } from "@freehold/db";
import { EmptyState } from "@/components/empty-state";
import { createClient, deleteClient, updateClientEsign } from "@/lib/actions/clients";
import { requireTenant } from "@/lib/tenant";
import { btn, btnGhost, card, input, label, summaryLink, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  AGENT: "Agent",
  BROKERAGE: "Brokerage",
  TITLE: "Title company",
  LENDER: "Lender",
  OTHER: "Other",
};

const ESIGN_LABEL: Record<string, string> = {
  MANUAL: "Manual / outside Freehold",
  DOCUMENSO: "Documenso",
  DOCUSIGN: "DocuSign",
};

export default async function ClientsPage() {
  const { tenantId } = await requireTenant();
  const clients = await withTenant(tenantId, (tx) =>
    tx.client.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { transactions: true } } },
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Clients</h1>
        <p className="text-sm text-stone-500">
          The agents, brokerages, and companies you coordinate transactions for.
        </p>
      </div>

      <details className={card}>
        <summary className={summaryLink}>New client</summary>
        <form action={createClient} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className={label}>
            Name *
            <input name="name" required className={input} placeholder="Sunrise Realty" />
          </label>
          <label className={label}>
            Type
            <select name="type" className={input} defaultValue="AGENT">
              {Object.values(ClientType).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Email
            <input name="email" type="email" className={input} />
          </label>
          <label className={label}>
            Phone
            <input name="phone" className={input} />
          </label>
          <label className={label}>
            E-sign provider
            <select name="esignProvider" className={input} defaultValue="">
              <option value="">Tenant default</option>
              {Object.values(EsignProvider).map((p) => (
                <option key={p} value={p}>
                  {ESIGN_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" className={btn}>
              Add client
            </button>
          </div>
        </form>
      </details>

      <section className={card}>
        {clients.length === 0 ? (
          <EmptyState
            title="No clients yet"
            hint='Clients are who you coordinate for — an agent, a brokerage, a title company. Each transaction belongs to one, and their preferences (like e-sign provider) follow automatically. Open "New client" above to add your first.'
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Type</th>
                <th className={th}>Email</th>
                <th className={th}>Phone</th>
                <th className={th}>E-sign</th>
                <th className={th}>Transactions</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className={trHover}>
                  <td className={`${td} font-medium`}>{c.name}</td>
                  <td className={td}>{TYPE_LABEL[c.type]}</td>
                  <td className={td}>{c.email ?? "—"}</td>
                  <td className={td}>{c.phone ?? "—"}</td>
                  <td className={td}>
                    <form action={updateClientEsign} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={c.id} />
                      <select
                        name="esignProvider"
                        defaultValue={c.esignProvider ?? ""}
                        className={`${input} px-2 py-1 text-xs`}
                      >
                        <option value="">Tenant default</option>
                        {Object.values(EsignProvider).map((p) => (
                          <option key={p} value={p}>
                            {ESIGN_LABEL[p]}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                        Save
                      </button>
                    </form>
                  </td>
                  <td className={td}>{c._count.transactions}</td>
                  <td className={td}>
                    <form action={deleteClient}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="text-xs text-stone-300 hover:text-red-600">
                        delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
