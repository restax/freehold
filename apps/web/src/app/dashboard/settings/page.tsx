import { prisma, withTenant } from "@freehold/db";
import { Badge } from "@/components/badges";
import { DangerDelete } from "@/components/danger-delete";
import {
  createApiKey,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  readNewApiKey,
  revokeApiKey,
} from "@/lib/actions/api-keys";
import { setContactVisibilityRestriction } from "@/lib/actions/contacts";
import { removeSampleData } from "@/lib/actions/sample-data";
import { saveSideLabels } from "@/lib/actions/website";
import { fmtDate } from "@/lib/format";
import { listTenants } from "@/lib/session";
import { tenantSideLabels } from "@/lib/side-labels";
import { getMemberRole, requireTenant } from "@/lib/tenant";
import { btn, btnGhost, card, input, label, td, th, trHover } from "@/lib/ui";
import { WEBHOOK_EVENTS } from "@/lib/webhook-emit";

export const dynamic = "force-dynamic";

async function ApiSection({ tenantId, userId }: { tenantId: string; userId: string }) {
  const role = await getMemberRole(tenantId, userId);
  const isAdmin = role === "owner" || role === "admin";
  if (!isAdmin) return null;
  const [keys, endpoints, newKey] = await Promise.all([
    prisma.apiKey.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
    withTenant(tenantId, (tx) => tx.webhookEndpoint.findMany({ orderBy: { createdAt: "desc" } })),
    readNewApiKey(),
  ]);

  return (
    <>
      <section className={card}>
        <h2 className="mb-1 font-medium">API keys</h2>
        <p className="mb-3 text-sm text-stone-500">
          Keys give full read/write access to this workspace through the REST API. Treat them like
          passwords.
        </p>
        {newKey && (
          <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2">
            <p className="text-sm font-medium text-brand-800">
              Copy this key now; it won't be shown again.
            </p>
            <code className="mt-1 block break-all font-mono text-xs text-stone-700">{newKey}</code>
          </div>
        )}
        {keys.length > 0 && (
          <table className="mb-4 w-full">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Key</th>
                <th className={th}>Created</th>
                <th className={th}>Last used</th>
                <th className={th}>Status</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className={trHover}>
                  <td className={`${td} font-medium`}>{k.name}</td>
                  <td className={`${td} font-mono text-xs`}>{k.prefix}…</td>
                  <td className={td}>{fmtDate(k.createdAt)}</td>
                  <td className={td}>{k.lastUsedAt ? fmtDate(k.lastUsedAt) : "never"}</td>
                  <td className={td}>
                    {k.revokedAt ? (
                      <Badge tone="neutral">revoked</Badge>
                    ) : (
                      <Badge tone="success">active</Badge>
                    )}
                  </td>
                  <td className={td}>
                    {!k.revokedAt && (
                      <form action={revokeApiKey}>
                        <input type="hidden" name="id" value={k.id} />
                        <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                          revoke
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={createApiKey} className="flex flex-wrap items-end gap-2">
          <label className={label}>
            Key name
            <input name="name" placeholder="Zapier connection" className={input} />
          </label>
          <button type="submit" className={btn}>
            Create key
          </button>
        </form>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-medium">Webhooks</h2>
        <p className="mb-3 text-sm text-stone-500">
          Freehold POSTs signed JSON to your URL when things happen. Verify the{" "}
          <code>freehold-signature</code> header with your endpoint's secret.
        </p>
        {endpoints.length > 0 && (
          <ul className="mb-4 flex flex-col">
            {endpoints.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-1 border-b border-stone-100 py-2 last:border-0"
              >
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-mono text-xs">{e.url}</span>
                  <span className="text-xs text-stone-400">{e.events.join(", ")}</span>
                  <div className="ml-auto">
                    <DangerDelete
                      compact
                      action={deleteWebhookEndpoint}
                      label="Delete"
                      description="Stops all deliveries to this endpoint."
                      hidden={{ id: e.id }}
                    />
                  </div>
                </div>
                <code className="break-all font-mono text-xs text-stone-400">
                  secret: {e.secret}
                </code>
              </li>
            ))}
          </ul>
        )}
        <form action={createWebhookEndpoint} className="flex flex-wrap items-end gap-3">
          <label className={`${label} min-w-72 flex-1`}>
            Endpoint URL
            <input name="url" placeholder="https://example.com/hooks/freehold" className={input} />
          </label>
          {WEBHOOK_EVENTS.map((ev) => (
            <label key={ev} className="flex items-center gap-1.5 pb-2 text-sm text-stone-700">
              <input
                type="checkbox"
                name={ev}
                defaultChecked={ev === "transaction.created"}
                className="accent-brand-600"
              />
              {ev}
            </label>
          ))}
          <button type="submit" className={btnGhost}>
            Add endpoint
          </button>
        </form>
      </section>
    </>
  );
}

async function ContactVisibilitySection({
  tenantId,
  userId,
}: {
  tenantId: string;
  userId: string;
}) {
  const role = await getMemberRole(tenantId, userId);
  if (role !== "owner" && role !== "admin") return null;
  const { prisma } = await import("@freehold/db");
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { restrictContactsToOwner: true },
  });
  return (
    <section className={card}>
      <h2 className="mb-1 font-medium">Contact visibility</h2>
      <p className="mb-3 text-sm text-stone-500">
        {org.restrictContactsToOwner
          ? "Members currently see only contacts they own. Owners and admins always see everything."
          : "Everyone currently sees all contacts. Restrict it so members see only contacts they own."}
      </p>
      <form action={setContactVisibilityRestriction}>
        <input type="hidden" name="restrict" value={org.restrictContactsToOwner ? "0" : "1"} />
        <button type="submit" className={btnGhost}>
          {org.restrictContactsToOwner
            ? "Open visibility to everyone"
            : "Restrict to owned contacts"}
        </button>
      </form>
    </section>
  );
}

async function AuditSection({ tenantId, userId }: { tenantId: string; userId: string }) {
  const role = await getMemberRole(tenantId, userId);
  if (role !== "owner" && role !== "admin") return null;
  const entries = await withTenant(tenantId, (tx) =>
    tx.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  );
  return (
    <section className={card}>
      <h2 className="mb-1 font-medium">Audit trail</h2>
      <p className="mb-3 text-sm text-stone-500">
        Who did what, newest first. Deletions, portal access changes, and other significant actions
        are recorded automatically. Last 100 entries.
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-stone-500">Nothing recorded yet.</p>
      ) : (
        <ul className="flex flex-col">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-stone-100 py-1.5 text-sm last:border-0"
            >
              <span className="whitespace-nowrap font-mono text-xs tabular-nums text-stone-400">
                {e.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </span>
              <span>{e.summary}</span>
              <span className="text-xs text-stone-400">{e.actorEmail ?? "system"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function SettingsPage() {
  const { tenantId, session } = await requireTenant();
  const tenants = await listTenants();
  const tenant = tenants.find((t) => t.id === tenantId);
  const sampleCount = await withTenant(tenantId, async (tx) => {
    const [transactions, contacts] = await Promise.all([
      tx.transaction.count({ where: { isSample: true } }),
      tx.contact.count({ where: { isSample: true } }),
    ]);
    return transactions + contacts;
  });

  const sideLabels = await tenantSideLabels(tenantId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section className={card}>
        <h2 className="mb-2 font-medium">Workspace</h2>
        <p className="text-sm">
          <span className="text-stone-500">Name:</span> {tenant?.name}
        </p>
        <p className="text-sm">
          <span className="text-stone-500">Signed in as:</span> {session.user.email}
        </p>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-medium">Side wording</h2>
        <p className="mb-3 text-sm text-stone-500">
          Different markets say it differently — sell side, sale side, list side. Whatever you type
          here is used everywhere sides appear: transactions, portals, and intake forms.
        </p>
        <form action={saveSideLabels} className="flex flex-wrap items-end gap-3">
          <label className={label}>
            Buy side is called
            <input name="buyLabel" defaultValue={sideLabels.buy} className={input} />
          </label>
          <label className={label}>
            Sell side is called
            <input name="sellLabel" defaultValue={sideLabels.sell} className={input} />
          </label>
          <button type="submit" className={btnGhost}>
            Save wording
          </button>
        </form>
      </section>

      <section className={card}>
        <h2 className="mb-2 font-medium">Sample data</h2>
        {sampleCount > 0 ? (
          <form action={removeSampleData} className="flex items-center gap-3">
            <p className="text-sm text-stone-500">
              This workspace contains sample records (marked “(Sample)”).
            </p>
            <button type="submit" className={btnGhost}>
              Remove all sample data
            </button>
          </form>
        ) : (
          <p className="text-sm text-stone-500">No sample data in this workspace.</p>
        )}
      </section>

      <ApiSection tenantId={tenantId} userId={session.user.id} />

      <ContactVisibilitySection tenantId={tenantId} userId={session.user.id} />

      <AuditSection tenantId={tenantId} userId={session.user.id} />

      <section className={card}>
        <h2 className="mb-2 font-medium">System health</h2>
        <p className="text-sm text-stone-500">
          Version 0.0.1 (Stage 01). Include this page in self-host support requests.
        </p>
      </section>
    </div>
  );
}
