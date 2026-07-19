import { withTenant } from "@freehold/db";
import { Buildings, LinkSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/badges";
import { DangerDelete } from "@/components/danger-delete";
import { RevealCredential } from "@/components/reveal-credential";
import {
  addClientAgent,
  addClientNote,
  deleteClient,
  removeClientAgent,
} from "@/lib/actions/clients";
import { createAgentPortalLink, setPortalLinkActive } from "@/lib/actions/portal";
import { fmtDate, fmtMoney } from "@/lib/format";
import { portalOrigin } from "@/lib/portal";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, btnGhost, card, input, label as labelCls, td, th, trHover } from "@/lib/ui";

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

  const [client, contacts] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.client.findUnique({
        where: { id },
        include: {
          clientNotes: { orderBy: { createdAt: "desc" }, take: 30 },
          portalLinks: { orderBy: { createdAt: "desc" } },
          agents: {
            orderBy: { createdAt: "asc" },
            include: {
              contact: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  grade: true,
                  photoUrl: true,
                  credentials: { select: { id: true, system: true, username: true, url: true } },
                },
              },
            },
          },
          credentials: {
            orderBy: { system: "asc" },
            select: { id: true, system: true, username: true, url: true },
          },
          transactions: {
            orderBy: { updatedAt: "desc" },
            include: { portalLinks: { orderBy: { createdAt: "desc" } } },
          },
        },
      }),
      tx.contact.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]),
  );
  if (!client) notFound();
  const portalBase = await portalOrigin(tenantId);
  const agentIds = new Set(client.agents.map((a) => a.contact.id));
  const addableContacts = contacts.filter((c) => !agentIds.has(c.id));
  const legacyAgentLinks = client.portalLinks.filter((pl) => !pl.contactId);

  const portalLinks = client.transactions.flatMap((t) =>
    t.portalLinks.filter((pl) => pl.audience === "CLIENT").map((pl) => ({ ...pl, transaction: t })),
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
        <h2 className="mb-1 font-medium">Agents</h2>
        <p className="mb-3 text-sm text-stone-500">
          Who works under {client.name}. Portal access is granted per agent — agents who don't want
          one simply never get a link.
        </p>
        {client.agents.length === 0 ? (
          <p className="mb-3 text-sm text-stone-400">No agents attached yet.</p>
        ) : (
          <ul className="mb-3 flex flex-col">
            {client.agents.map((a) => {
              const agentLinks = client.portalLinks.filter((pl) => pl.contactId === a.contact.id);
              const activeLink = agentLinks.find((pl) => !pl.revokedAt);
              return (
                <li key={a.id} className="border-b border-stone-100 py-3 last:border-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/dashboard/contacts/${a.contact.id}`}
                      className="text-sm font-medium text-brand-700 hover:text-brand-600"
                    >
                      {a.contact.name}
                    </Link>
                    {a.contact.grade && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
                        {a.contact.grade}
                      </span>
                    )}
                    <span className="text-xs text-stone-400">
                      {[a.contact.email, a.contact.phone].filter(Boolean).join(" · ")}
                      {a.contact.credentials.length > 0 &&
                        ` · ${a.contact.credentials.length} credential${a.contact.credentials.length === 1 ? "" : "s"}`}
                    </span>
                    <div className="ml-auto flex items-center gap-3">
                      {!activeLink && agentLinks.length === 0 && (
                        <form action={createAgentPortalLink}>
                          <input type="hidden" name="clientId" value={client.id} />
                          <input type="hidden" name="contactId" value={a.contact.id} />
                          <button type="submit" className={`${btnGhost} px-2.5 py-1 text-xs`}>
                            Give portal access
                          </button>
                        </form>
                      )}
                      <form action={removeClientAgent}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          type="submit"
                          className="text-xs text-stone-300 hover:text-red-600"
                          title="Detach from this client — deactivates their portal links, deletes nothing"
                        >
                          remove
                        </button>
                      </form>
                    </div>
                  </div>
                  {agentLinks.map((pl) => {
                    const active = !pl.revokedAt;
                    return (
                      <div key={pl.id} className="mt-2 flex flex-wrap items-center gap-3 pl-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                            active ? "bg-brand-50 text-brand-800" : "bg-stone-100 text-stone-500"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 rounded-full ${active ? "bg-brand-500" : "bg-stone-400"}`}
                          />
                          {active ? "Portal active" : "Portal inactive"}
                        </span>
                        {pl.lastAccessedAt && (
                          <span className="text-xs text-stone-400">
                            last opened {fmtDate(pl.lastAccessedAt)}
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-3">
                          {active && (
                            <>
                              <a
                                href={`${portalBase}/portal/${pl.token}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-medium text-brand-700 hover:underline"
                              >
                                View as agent
                              </a>
                              <a
                                href={`mailto:${a.contact.email ?? ""}?subject=${encodeURIComponent(`Your transaction portal — ${client.name}`)}&body=${encodeURIComponent(`Here's your live portal with every deal, deadline, and document:\n\n${portalBase}/portal/${pl.token}\n\nBookmark it — it's always current.`)}`}
                                className="text-xs font-medium text-brand-700 hover:underline"
                              >
                                Email link
                              </a>
                            </>
                          )}
                          <form action={setPortalLinkActive}>
                            <input type="hidden" name="id" value={pl.id} />
                            <input type="hidden" name="active" value={active ? "0" : "1"} />
                            <button type="submit" className={`${btnGhost} px-2.5 py-1 text-xs`}>
                              {active ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        )}
        <form action={addClientAgent} className="flex items-end gap-2">
          <input type="hidden" name="clientId" value={client.id} />
          <label className={labelCls}>
            Add an agent
            <select name="contactId" required className={`${input} w-64`} defaultValue="">
              <option value="" disabled>
                Pick a contact…
              </option>
              {addableContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={btn}>
            Attach
          </button>
        </form>
        {legacyAgentLinks.length > 0 && (
          <div className="mt-4 border-t border-stone-100 pt-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
              Client-wide portal links
            </h3>
            <ul className="flex flex-col">
              {legacyAgentLinks.map((pl) => {
                const active = !pl.revokedAt;
                return (
                  <li
                    key={pl.id}
                    className="flex flex-wrap items-center gap-3 border-b border-stone-100 py-2 last:border-0"
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
                    {pl.lastAccessedAt && (
                      <span className="text-xs text-stone-400">
                        last opened {fmtDate(pl.lastAccessedAt)}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-3">
                      {active && (
                        <a
                          href={`${portalBase}/portal/${pl.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-brand-700 hover:underline"
                        >
                          View as agent
                        </a>
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
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-1 font-medium">Credentials</h2>
        <p className="mb-3 text-sm text-stone-500">
          Vault logins for {client.name} and their agents — encrypted at rest, every reveal audited.
        </p>
        {client.credentials.length === 0 &&
        client.agents.every((a) => a.contact.credentials.length === 0) ? (
          <p className="text-sm text-stone-400">
            Nothing stored yet.{" "}
            <Link href="/dashboard/vault" className="text-brand-700 hover:underline">
              Add one in the vault →
            </Link>
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>System</th>
                <th className={th}>Belongs to</th>
                <th className={th}>Username</th>
                <th className={th}>Secret</th>
                <th className={th}>URL</th>
              </tr>
            </thead>
            <tbody>
              {[
                ...client.credentials.map((c) => ({ ...c, who: client.name, contactId: null })),
                ...client.agents.flatMap((a) =>
                  a.contact.credentials.map((c) => ({
                    ...c,
                    who: a.contact.name,
                    contactId: a.contact.id,
                  })),
                ),
              ].map((c) => (
                <tr key={c.id} className={trHover}>
                  <td className={`${td} font-medium`}>{c.system}</td>
                  <td className={td}>
                    {c.contactId ? (
                      <Link
                        href={`/dashboard/contacts/${c.contactId}`}
                        className="text-brand-700 hover:underline"
                      >
                        {c.who}
                      </Link>
                    ) : (
                      c.who
                    )}
                  </td>
                  <td className={td}>{c.username}</td>
                  <td className={td}>
                    <RevealCredential credentialId={c.id} />
                  </td>
                  <td className={td}>
                    {c.url ? (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline"
                      >
                        open
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-stone-400">
          Add or delete credentials in the{" "}
          <Link href="/dashboard/vault" className="underline hover:text-brand-700">
            vault
          </Link>
          .
        </p>
      </section>

      <section className={card}>
        <h2 className="mb-1 flex items-center gap-2 font-medium">
          <LinkSimple size={17} weight="bold" className="text-brand-600" aria-hidden />
          Buyer &amp; seller portals
        </h2>
        <p className="mb-3 text-sm text-stone-500">
          Per-transaction links for buyers and sellers. Deactivating a link shuts it off instantly —
          the same link works again if you reactivate.
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

      <section className={card}>
        <h2 className="mb-1 font-medium">Notes</h2>
        <p className="mb-3 text-sm text-stone-500">Internal only — never visible on any portal.</p>
        <form action={addClientNote} className="mb-3 flex items-end gap-2">
          <input type="hidden" name="clientId" value={client.id} />
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-stone-700">
            Add a note
            <input
              name="body"
              placeholder="Prefers text over email; closes ~4 deals a month…"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
            />
          </label>
          <button type="submit" className={btnGhost}>
            Add
          </button>
        </form>
        {client.clientNotes.length === 0 ? (
          <p className="text-sm text-stone-400">No notes yet.</p>
        ) : (
          <ul className="flex flex-col">
            {client.clientNotes.map((n) => (
              <li key={n.id} className="border-b border-stone-100 py-2 text-sm last:border-0">
                <span className="mr-3 font-mono text-xs tabular-nums text-stone-400">
                  {fmtDate(n.createdAt)}
                </span>
                {n.body}
              </li>
            ))}
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
