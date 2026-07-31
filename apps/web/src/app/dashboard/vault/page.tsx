import { withTenant } from "@freehold/db";
import { Badge, type BadgeTone } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { RevealCredential } from "@/components/reveal-credential";
import { SectionCard } from "@/components/section-card";
import { createCredential, deleteCredential } from "@/lib/actions/vault";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btn, btnAdd, card, input, label, tableWrap, td, th, trHover } from "@/lib/ui";

const LOG_TONE: Record<string, BadgeTone> = {
  REVEALED: "progress",
  DELETED: "danger",
};

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const { tenantId } = await requireTenant();
  const { credentials, clients, contacts, log } = await withTenant(tenantId, async (tx) => ({
    credentials: await tx.vaultCredential.findMany({
      orderBy: [{ clientId: "asc" }, { system: "asc" }],
      include: {
        client: { select: { name: true } },
        contact: { select: { id: true, name: true } },
      },
    }),
    clients: await tx.client.findMany({ orderBy: { name: "asc" } }),
    contacts: await tx.contact.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    log: await tx.vaultAccessLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { credential: { select: { system: true } } },
    }),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Credential vault</h1>
        <p className="text-sm text-stone-500">
          Client logins (MLS, lender portals, e-sign accounts): encrypted at rest, revealed only on
          click, every reveal audited. Freehold never logs into anything automatically. Store
          credentials only with your client's consent.
        </p>
      </div>

      {!process.env.VAULT_MASTER_KEY && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <code>VAULT_MASTER_KEY</code> is not set — generate one with{" "}
          <code>openssl rand -base64 32</code> and add it to <code>.env</code>.
        </p>
      )}

      <details>
        <summary className={`${btnAdd} w-fit list-none`}>+ Add credential</summary>
        <form
          action={createCredential}
          className={`${card} mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}
        >
          <label className={label}>
            System *
            <input name="system" required placeholder="MLS — MRED" className={input} />
          </label>
          <label className={label}>
            Client
            <select name="clientId" className={input} defaultValue="">
              <option value="">— (tenant-wide)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Agent / contact
            <select name="contactId" className={input} defaultValue="">
              <option value="">—</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Username *
            <input name="username" required className={input} />
          </label>
          <label className={label}>
            Password / secret *
            <input name="secret" type="password" required className={input} />
          </label>
          <label className={label}>
            Login URL
            <input name="url" placeholder="https://..." className={input} />
          </label>
          <label className={label}>
            Notes
            <input name="notes" className={input} />
          </label>
          <div className="flex items-end">
            <button type="submit" className={btn}>
              Save encrypted
            </button>
          </div>
        </form>
      </details>

      <section className={card}>
        {credentials.length === 0 ? (
          <EmptyState
            title="The vault is empty"
            hint="Store a client's MLS or lender-portal login and it's encrypted before it touches the database — nobody sees it again without an audited reveal."
          />
        ) : (
          <div className={tableWrap}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>System</th>
                  <th className={th}>Belongs to</th>
                  <th className={th}>Username</th>
                  <th className={th}>Secret</th>
                  <th className={th}>URL</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {credentials.map((c) => (
                  <tr key={c.id} className={trHover}>
                    <td className={`${td} font-medium`}>{c.system}</td>
                    <td className={td}>
                      {c.contact ? (
                        <a
                          href={`/dashboard/contacts/${c.contact.id}?tab=credentials`}
                          className="text-brand-700 hover:underline"
                        >
                          {c.contact.name}
                        </a>
                      ) : (
                        (c.client?.name ?? "—")
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
                    <td className={td}>
                      <form action={deleteCredential}>
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
          </div>
        )}
      </section>

      <SectionCard title="Access log">
        {log.length === 0 ? (
          <p className="text-sm text-stone-500">No vault activity yet.</p>
        ) : (
          <ul className="flex flex-col text-sm">
            {log.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap gap-2 border-b border-stone-100 py-1.5 last:border-0"
              >
                <span className="text-stone-400">{fmtDate(entry.createdAt)}</span>
                <Badge tone={LOG_TONE[entry.action] ?? "neutral"}>
                  {entry.action.toLowerCase()}
                </Badge>
                <span>{entry.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
