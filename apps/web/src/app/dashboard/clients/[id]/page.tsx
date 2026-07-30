import { ClientType, prisma, withTenant } from "@freehold/db";
import {
  Buildings,
  LinkSimple,
  MapPin,
  Receipt,
  Sparkle,
  Storefront,
  User,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Badge, StatusBadge } from "@/components/badges";
import { DangerDelete } from "@/components/danger-delete";
import { RevealCredential } from "@/components/reveal-credential";
import { RevealSkyslope } from "@/components/reveal-skyslope";
import { SectionCard } from "@/components/section-card";
import { saveClientBilling } from "@/lib/actions/billing-policy";
import {
  addClientAgent,
  addClientAgentInline,
  addClientNote,
  deleteClient,
  removeClientAgent,
  saveClientAlertConfig,
  saveClientEmailPrefs,
  setClientIntakeAi,
  updateClientProfile,
  updateClientType,
} from "@/lib/actions/clients";
import { setClientCompliance } from "@/lib/actions/compliance";
import { createClientFormVariant } from "@/lib/actions/forms";
import { createAgentPortalLink, setPortalLinkActive } from "@/lib/actions/portal";
import { connectSkyslope, disconnectSkyslope } from "@/lib/actions/skyslope";
import { createCredential } from "@/lib/actions/vault";
import { BILLING_MODE_LABEL, BILLING_MODES, tenantBillingPolicy } from "@/lib/billing-policy";
import {
  billingContactFrom,
  brokerageInfoFrom,
  CLIENT_TYPE_LABEL,
  clientKind,
} from "@/lib/client-profile";
import { parseEmailPrefs } from "@/lib/email-prefs";
import { FORM_KIND_LABEL } from "@/lib/form-schema";
import { fmtDate, fmtMoney } from "@/lib/format";
import { transactionHasPro } from "@/lib/plans";
import { portalOrigin } from "@/lib/portal";
import { decodeSkyslopeConfig, maskKey, parseSkyslopeConfig, skyslopeState } from "@/lib/skyslope";
import { requireAdminTenant } from "@/lib/tenant";
import { DEFAULT_ALERT_CONFIG } from "@/lib/transaction-alerts";
import {
  btn,
  btnGhost,
  card,
  fieldGroupLabel,
  input,
  label as labelCls,
  summaryLink,
  tableWrap,
  td,
  th,
  trHover,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

/** Header icon per type — an office is a building, an agent is a person. */
const TYPE_ICON: Record<string, typeof Buildings> = {
  AGENT: User,
  BROKERAGE: Buildings,
  TEAM: UsersThree,
  TITLE: Storefront,
  LENDER: Storefront,
  OTHER: Storefront,
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
          complianceChecklist: { select: { id: true, name: true } },
          transactions: {
            orderBy: { updatedAt: "desc" },
            include: { portalLinks: { orderBy: { createdAt: "desc" } } },
          },
        },
      }),
      tx.contact.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]),
  );
  const checklists = await withTenant(tenantId, (tx) =>
    tx.complianceChecklist.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  );
  // Forms this client could be given their own version of, and any they
  // already have. A private variant wins over the shared form for them.
  const [sharedForms, ownForms] = await withTenant(tenantId, async (tx) => [
    await tx.form.findMany({
      where: { clientId: null, showPortal: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true },
    }),
    await tx.form.findMany({
      where: { clientId: id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true, status: true },
    }),
  ]);
  if (!client) notFound();
  // Reading intake contracts is a paid-plan feature; the switch says so
  // rather than accepting a setting that would never fire.
  const planHasPro = await transactionHasPro(tenantId, false);
  const portalBase = await portalOrigin(tenantId);
  const agentIds = new Set(client.agents.map((a) => a.contact.id));
  const addableContacts = contacts.filter((c) => !agentIds.has(c.id));
  const legacyAgentLinks = client.portalLinks.filter((pl) => !pl.contactId);
  const emailPrefs = parseEmailPrefs(client.emailPrefs);
  // The *stored* overrides, not the resolved config: an empty input means
  // "use the workspace default", so the placeholder shows what that default is.
  const alertCfg = (client.alertConfig ?? {}) as Partial<{
    staleDays: number;
    criticalWindowDays: number;
    criticalStaleDays: number;
  }>;
  // Billing: stored overrides (not the resolved policy) so the form shows
  // exactly what's overridden, with workspace defaults as placeholders.
  const orgBilling = tenantBillingPolicy(
    (
      await prisma.organization.findUniqueOrThrow({
        where: { id: tenantId },
        select: { billingDefaults: true },
      })
    ).billingDefaults,
  );
  const billingCfg = (client.billingConfig ?? {}) as Partial<{
    mode: string;
    lateFee: {
      enabled?: boolean;
      type?: string;
      flatCents?: number;
      percent?: number;
      graceDays?: number;
    };
  }>;
  const lateFeeChoice =
    billingCfg.lateFee?.enabled === true
      ? "on"
      : billingCfg.lateFee?.enabled === false
        ? "off"
        : "";

  // SkySlope: the stored key is only ever shown masked, so decrypt just enough
  // to render its last four. The full value needs the audited reveal.
  const skyslopeCfg = parseSkyslopeConfig(client.skyslopeConfig);
  const skyslope = {
    config: skyslopeCfg,
    state: skyslopeState(skyslopeCfg),
    maskedKey: skyslopeCfg ? decodeSkyslopeConfig(skyslopeCfg).accessKey : "",
  };

  const portalLinks = client.transactions.flatMap((t) =>
    t.portalLinks.filter((pl) => pl.audience === "CLIENT").map((pl) => ({ ...pl, transaction: t })),
  );

  const kind = clientKind(client.type);
  const billingContact = billingContactFrom(client.billingContact);
  const brokerage = brokerageInfoFrom(client.brokerageInfo);
  const TypeIcon = TYPE_ICON[client.type] ?? Storefront;
  // Offices always have a roster; anything else keeps the section only if a
  // roster already exists (legacy data must stay reachable, never orphaned).
  const showAgents = kind === "office" || client.agents.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/dashboard/clients" className="text-sm text-stone-500 hover:underline">
          ← Clients
        </Link>
        <h1 className="flex flex-wrap items-center gap-2.5 text-xl font-semibold">
          <TypeIcon size={20} weight="duotone" className="text-brand-600" aria-hidden />
          {client.name}
          <form action={updateClientType} className="flex items-center gap-1.5">
            <input type="hidden" name="id" value={client.id} />
            <select
              name="type"
              defaultValue={client.type}
              title="Reclassify this client"
              className={`${input} rounded-full border-none bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700`}
            >
              {Object.values(ClientType).map((t) => (
                <option key={t} value={t}>
                  {CLIENT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <button type="submit" className={`${btnGhost} px-2 py-0.5 text-xs`}>
              Save
            </button>
          </form>
        </h1>
        <p className="text-sm text-stone-500">
          {[client.email, client.phone].filter(Boolean).join(" · ") || "No contact info yet"}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-500">
          {client.address && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-stone-400" aria-hidden />
              {client.address}
            </span>
          )}
          {kind === "office" && billingContact && (
            <span
              className="flex items-center gap-1.5"
              title="Invoices email the billing contact when one is set"
            >
              <Receipt size={14} className="text-stone-400" aria-hidden />
              Billing:{" "}
              {[billingContact.name, billingContact.email, billingContact.phone]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
          {kind === "individual" && brokerage && (
            <span className="flex items-center gap-1.5">
              <Buildings size={14} className="text-stone-400" aria-hidden />
              {[brokerage.name, brokerage.phone, brokerage.address].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      </div>

      <details className={card}>
        <summary className={summaryLink}>Edit profile</summary>
        <form action={updateClientProfile} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="id" value={client.id} />
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={labelCls}>
              {kind === "office" ? "Office name *" : "Name *"}
              <input name="name" required defaultValue={client.name} className={input} />
            </label>
            <label className={labelCls}>
              Email
              <input
                name="email"
                type="email"
                defaultValue={client.email ?? ""}
                className={input}
              />
            </label>
            <label className={labelCls}>
              Phone
              <input name="phone" defaultValue={client.phone ?? ""} className={input} />
            </label>
            {/* One field, so it takes the whole one-line address rather than
                splitting into city/state/zip columns this form doesn't have. */}
            <AddressAutocomplete
              name="address"
              label={kind === "office" ? "Office address" : "Address"}
              defaultValue={client.address ?? ""}
            />
          </div>
          {kind === "office" && (
            <div className="border-t border-stone-100 pt-3">
              <p className={fieldGroupLabel}>Billing contact</p>
              <p className="mb-2 text-xs text-stone-400">
                Invoices email the billing contact when one is set, the office email otherwise.
              </p>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className={labelCls}>
                  Name
                  <input
                    name="billingName"
                    defaultValue={billingContact?.name ?? ""}
                    className={input}
                  />
                </label>
                <label className={labelCls}>
                  Email
                  <input
                    name="billingEmail"
                    type="email"
                    defaultValue={billingContact?.email ?? ""}
                    className={input}
                  />
                </label>
                <label className={labelCls}>
                  Phone
                  <input
                    name="billingPhone"
                    defaultValue={billingContact?.phone ?? ""}
                    className={input}
                  />
                </label>
              </div>
            </div>
          )}
          {kind === "individual" && (
            <div className="border-t border-stone-100 pt-3">
              <p className={fieldGroupLabel}>Their brokerage</p>
              <p className="mb-2 text-xs text-stone-400">
                Where they hang their license — reference info for your file.
              </p>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_2fr]">
                <label className={labelCls}>
                  Brokerage name
                  <input
                    name="brokerageName"
                    defaultValue={brokerage?.name ?? ""}
                    className={input}
                  />
                </label>
                <label className={labelCls}>
                  Brokerage phone
                  <input
                    name="brokeragePhone"
                    defaultValue={brokerage?.phone ?? ""}
                    className={input}
                  />
                </label>
                <AddressAutocomplete
                  name="brokerageAddress"
                  label="Brokerage address"
                  defaultValue={brokerage?.address ?? ""}
                />
              </div>
            </div>
          )}
          <div className="border-t border-stone-100 pt-3">
            <button type="submit" className={btn}>
              Save profile
            </button>
          </div>
        </form>
      </details>

      <SectionCard title="Transactions">
        {client.transactions.length === 0 ? (
          <p className="text-sm text-stone-500">
            No transactions for this client yet.{" "}
            <Link href="/dashboard/transactions" className="text-brand-700 hover:underline">
              Create one →
            </Link>
          </p>
        ) : (
          <div className={tableWrap}>
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
          </div>
        )}
      </SectionCard>

      {showAgents && (
        <section className={card}>
          <h2 className="mb-1 flex items-center gap-2 font-medium">
            <UsersThree size={16} className="text-stone-400" aria-hidden />
            Agents
            {client.agents.length > 0 && (
              <span className="text-xs font-normal text-stone-400">{client.agents.length}</span>
            )}
          </h2>
          <p className="mb-3 text-sm text-stone-500">
            Who works under {client.name}. Portal access and vault logins are per agent — agents who
            don't want a portal simply never get a link.
          </p>
          {client.agents.length === 0 ? (
            <p className="mb-3 text-sm text-stone-400">No agents on the roster yet.</p>
          ) : (
            <ul className="mb-3 flex flex-col">
              {client.agents.map((a) => {
                const agentLinks = client.portalLinks.filter((pl) => pl.contactId === a.contact.id);
                const activeLink = agentLinks.find((pl) => !pl.revokedAt);
                return (
                  <li key={a.id} className="border-b border-stone-100 py-2 last:border-0">
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
                          ` · ${a.contact.credentials.length} login${a.contact.credentials.length === 1 ? "" : "s"} in the vault`}
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
                    <details className="mt-1.5 pl-4">
                      <summary className={`${summaryLink} text-xs`}>
                        Store a login for {a.contact.name.split(" ")[0]}
                      </summary>
                      <form
                        action={createCredential}
                        className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-stone-50 p-3"
                      >
                        <input type="hidden" name="clientId" value={client.id} />
                        <input type="hidden" name="contactId" value={a.contact.id} />
                        <input
                          type="hidden"
                          name="backTo"
                          value={`/dashboard/clients/${client.id}`}
                        />
                        <label className={labelCls}>
                          System
                          <input
                            name="system"
                            required
                            className={`${input} w-40`}
                            placeholder="MLS"
                          />
                        </label>
                        <label className={labelCls}>
                          Username
                          <input name="username" required className={`${input} w-44`} />
                        </label>
                        <label className={labelCls}>
                          Secret
                          <input
                            name="secret"
                            type="password"
                            required
                            className={`${input} w-44`}
                          />
                        </label>
                        <label className={labelCls}>
                          URL
                          <input name="url" className={`${input} w-44`} placeholder="https://" />
                        </label>
                        <button type="submit" className={btn}>
                          Store encrypted
                        </button>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-col gap-3 border-t border-stone-100 pt-3">
            <form action={addClientAgentInline} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="clientId" value={client.id} />
              <label className={labelCls}>
                New agent *
                <input name="name" required className={`${input} w-48`} placeholder="Priya Raman" />
              </label>
              <label className={labelCls}>
                Email
                <input name="email" type="email" className={`${input} w-52`} />
              </label>
              <label className={labelCls}>
                Phone
                <input name="phone" className={`${input} w-36`} />
              </label>
              <button type="submit" className={btn}>
                Add to roster
              </button>
              <span className="pb-1.5 text-xs text-stone-400">
                Creates their contact record and attaches it here.
              </span>
            </form>
            {addableContacts.length > 0 && (
              <details>
                <summary className={`${summaryLink} text-xs`}>
                  Or attach an existing contact
                </summary>
                <form action={addClientAgent} className="mt-2 flex items-end gap-2">
                  <input type="hidden" name="clientId" value={client.id} />
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
                  <button type="submit" className={btnGhost}>
                    Attach
                  </button>
                </form>
              </details>
            )}
          </div>
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
      )}

      <SectionCard title="Credentials">
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
          <div className={tableWrap}>
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
                {(() => {
                  // A login can carry both clientId and contactId (stored for
                  // an agent from this page) — the agent row wins, the
                  // client-level list drops it, so it renders exactly once.
                  const agentCredIds = new Set(
                    client.agents.flatMap((a) => a.contact.credentials.map((c) => c.id)),
                  );
                  return [
                    ...client.credentials
                      .filter((c) => !agentCredIds.has(c.id))
                      .map((c) => ({ ...c, who: client.name, contactId: null as string | null })),
                    ...client.agents.flatMap((a) =>
                      a.contact.credentials.map((c) => ({
                        ...c,
                        who: a.contact.name,
                        contactId: a.contact.id as string | null,
                      })),
                    ),
                  ];
                })().map((c) => (
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
          </div>
        )}
        <p className="mt-3 text-xs text-stone-400">
          Add or delete credentials in the{" "}
          <Link href="/dashboard/vault" className="underline hover:text-brand-700">
            vault
          </Link>
          .
        </p>
      </SectionCard>

      {isAdmin && (
        <SectionCard title="SkySlope API access">
          <p className="mb-3 text-sm text-stone-500">
            {client.name} generates an Access Key and Secret in SkySlope under{" "}
            <strong>My Account → Integrations → Generate New Key</strong> and gives them to you.
            Stored encrypted, shown only masked, and every reveal is written to the vault's audit
            log — these are their credentials, not yours.
          </p>

          {skyslope.state === "partner-missing" && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              This install has no SkySlope partner credentials, so stored keys can't be used yet.
              SkySlope issues a ClientID and Secret per licensee once an agreement is signed; set
              them as <code>SKYSLOPE_CLIENT_ID</code> and <code>SKYSLOPE_CLIENT_SECRET</code>. You
              can still store an agent's key here in the meantime.
            </p>
          )}

          {skyslope.config ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge tone={skyslope.state === "verified" ? "success" : "progress"}>
                  {skyslope.state === "verified" ? "Verified" : "Stored, not yet verified"}
                </Badge>
                <span className="font-mono text-xs text-stone-600">
                  {maskKey(skyslope.maskedKey)}
                </span>
                {skyslope.config.label && (
                  <span className="text-xs text-stone-400">{skyslope.config.label}</span>
                )}
                <span className="text-xs text-stone-400">
                  added {fmtDate(new Date(skyslope.config.connectedAt))}
                </span>
                <RevealSkyslope clientId={client.id} />
                <form action={disconnectSkyslope} className="ml-auto">
                  <input type="hidden" name="clientId" value={client.id} />
                  <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                    remove
                  </button>
                </form>
              </div>
              {skyslope.state === "stored" && (
                <p className="text-xs text-stone-400">
                  Freehold hasn't called SkySlope with this key yet, so it hasn't been proven to
                  work. Reading their transactions arrives with the sync stage.
                </p>
              )}
            </div>
          ) : (
            <form action={connectSkyslope} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="clientId" value={client.id} />
              <label className={labelCls}>
                Access Key *
                <input name="accessKey" required className={input} />
              </label>
              <label className={labelCls}>
                Secret *
                <input name="secret" type="password" required className={input} />
              </label>
              <label className={labelCls}>
                Label
                <input name="label" placeholder="casey@sunriserealty" className={input} />
              </label>
              <button type="submit" className={btnGhost}>
                Store credentials
              </button>
            </form>
          )}
        </SectionCard>
      )}

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

      <SectionCard title="Their forms">
        <p className="mb-3 text-sm text-stone-500">
          {client.name} sees your shared portal forms unless you give them their own version. A
          private version starts as a copy and stays a draft until you publish it — until then they
          keep seeing the shared one.
        </p>
        {ownForms.length > 0 && (
          <ul className="mb-3 flex flex-col">
            {ownForms.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
              >
                <Link
                  href={`/dashboard/forms/${f.id}`}
                  className="font-medium text-brand-700 hover:text-brand-600"
                >
                  {f.name}
                </Link>
                <Badge tone={f.status === "published" ? "success" : "neutral"}>
                  {f.status === "published" ? "Published" : "Draft"}
                </Badge>
                <span className="text-xs text-stone-400">{FORM_KIND_LABEL[f.kind] ?? f.kind}</span>
              </li>
            ))}
          </ul>
        )}
        {sharedForms.filter((sf) => !ownForms.some((of) => of.kind === sf.kind)).length > 0 ? (
          <form action={createClientFormVariant} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="clientId" value={client.id} />
            <label className={labelCls}>
              Give them their own version of
              <select name="sourceFormId" required className={`${input} w-72`} defaultValue="">
                <option value="" disabled>
                  Pick a form…
                </option>
                {sharedForms
                  .filter((sf) => !ownForms.some((of) => of.kind === sf.kind))
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </label>
            <button type="submit" className={btn}>
              Create their version
            </button>
          </form>
        ) : (
          <p className="text-sm text-stone-400">
            {sharedForms.length === 0
              ? "No portal forms yet — design one under Forms and place it in client portals."
              : "They already have their own version of every portal form."}
          </p>
        )}

        <form
          action={setClientIntakeAi}
          className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-stone-100 pt-4"
        >
          <input type="hidden" name="id" value={client.id} />
          <Sparkle size={16} weight="duotone" className="shrink-0 text-brand-600" aria-hidden />
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              name="intakeAi"
              defaultChecked={client.intakeAiExtraction}
              disabled={!planHasPro}
              className="accent-brand-600 disabled:opacity-40"
            />
            Read their intake contracts with AI
          </label>
          <button type="submit" className={btnGhost} disabled={!planHasPro}>
            Save
          </button>
          <p className="w-full text-xs leading-relaxed text-stone-500">
            {planHasPro ? (
              <>
                Off by default. When it's on, a contract attached to one of {client.name}'s intake
                forms is read as soon as you convert the submission, and the file opens with the
                dates and figures waiting for your approval — nothing is applied until you accept
                it.
              </>
            ) : (
              <>
                Reading contracts is a paid-plan feature.{" "}
                <Link href="/dashboard/billing" className="text-brand-700 hover:underline">
                  See plans
                </Link>{" "}
                — a contract that arrives on this client's forms is stored either way.
              </>
            )}
          </p>
        </form>
      </SectionCard>

      <SectionCard title="Compliance">
        <p className="mb-3 text-sm text-stone-500">
          {client.complianceEnabled && client.complianceChecklist ? (
            <>
              Every file for {client.name} must carry the documents on{" "}
              <Link
                href={`/dashboard/compliance/${client.complianceChecklist.id}`}
                className="text-brand-700 hover:underline"
              >
                {client.complianceChecklist.name}
              </Link>
              .
            </>
          ) : client.complianceEnabled ? (
            <>
              Compliance is on for {client.name}, but no checklist is assigned yet — nothing is
              required until you pick one.
            </>
          ) : (
            <>Compliance is switched off for {client.name}. Their files have no requirements.</>
          )}
        </p>
        <form action={setClientCompliance} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="clientId" value={client.id} />
          <label className={labelCls}>
            Checklist
            <select
              name="checklistId"
              defaultValue={client.complianceChecklistId ?? ""}
              className={input}
            >
              <option value="">— none —</option>
              {checklists.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={client.complianceEnabled}
              className="accent-brand-600"
            />
            Compliance required
          </label>
          <button type="submit" className={btnGhost}>
            Save compliance rules
          </button>
          {checklists.length === 0 && (
            <span className="pb-2 text-xs text-stone-400">
              No checklists yet —{" "}
              <Link href="/dashboard/compliance" className="text-brand-700 hover:underline">
                create one
              </Link>
              .
            </span>
          )}
        </form>
      </SectionCard>

      <SectionCard title="Billing">
        <p className="mb-3 text-sm text-stone-500">
          How {client.name} is billed. Anything left on “workspace default” follows Settings →
          Client billing defaults; overrides here win for this client only.
        </p>
        <form action={saveClientBilling} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={client.id} />
          <div className="flex flex-wrap items-end gap-3">
            <label className={labelCls}>
              Billing rhythm
              <select name="mode" defaultValue={billingCfg.mode ?? ""} className={input}>
                <option value="">Workspace default — {BILLING_MODE_LABEL[orgBilling.mode]}</option>
                {BILLING_MODES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Standard fee ($ per file)
              <input
                name="defaultFee"
                inputMode="decimal"
                defaultValue={
                  client.defaultFeeCents == null ? "" : (client.defaultFeeCents / 100).toFixed(2)
                }
                placeholder={
                  orgBilling.defaultFeeCents == null
                    ? "350.00"
                    : (orgBilling.defaultFeeCents / 100).toFixed(2)
                }
                className={`${input} w-32`}
              />
              <span className="text-xs font-normal text-stone-400">
                auto-fills each new file's expected fee
              </span>
            </label>
            <label className={labelCls}>
              Late fees
              <select name="lateFeeChoice" defaultValue={lateFeeChoice} className={input}>
                <option value="">
                  Workspace default — {orgBilling.lateFee.enabled ? "on" : "off"}
                </option>
                <option value="on">On for this client</option>
                <option value="off">Off for this client</option>
              </select>
            </label>
            <label className={labelCls}>
              Type
              <select
                name="lateFeeType"
                defaultValue={billingCfg.lateFee?.type ?? orgBilling.lateFee.type}
                className={input}
              >
                <option value="flat">Flat amount</option>
                <option value="percent">% of invoice</option>
              </select>
            </label>
            <label className={labelCls}>
              Flat ($)
              <input
                name="lateFeeFlat"
                inputMode="decimal"
                defaultValue={(
                  (billingCfg.lateFee?.flatCents ?? orgBilling.lateFee.flatCents) / 100
                ).toFixed(2)}
                className={`${input} w-24`}
              />
            </label>
            <label className={labelCls}>
              Percent
              <input
                name="lateFeePercent"
                type="number"
                step="0.1"
                min={0}
                max={100}
                defaultValue={billingCfg.lateFee?.percent ?? orgBilling.lateFee.percent}
                className={`${input} w-24`}
              />
            </label>
            <label className={labelCls}>
              Grace (days)
              <input
                name="lateFeeGrace"
                type="number"
                min={0}
                max={365}
                defaultValue={billingCfg.lateFee?.graceDays ?? orgBilling.lateFee.graceDays}
                className={`${input} w-24`}
              />
            </label>
          </div>
          <button type="submit" className={btnGhost}>
            Save billing
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Quiet-file alerts">
        <p className="mb-3 text-sm text-stone-500">
          How long one of {client.name}'s files may sit untouched before it's flagged — on the
          dashboard, the transaction, and the daily briefing. Counted in business days, so weekends
          never age a file. Leave a box empty to use the workspace default.
        </p>
        <form action={saveClientAlertConfig} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={client.id} />
          <label className={labelCls}>
            Flag after
            <input
              name="staleDays"
              type="number"
              min={1}
              max={60}
              defaultValue={alertCfg.staleDays ?? ""}
              placeholder={String(DEFAULT_ALERT_CONFIG.staleDays)}
              className={`${input} w-28`}
            />
            <span className="text-xs text-stone-400">business days quiet</span>
          </label>
          <label className={labelCls}>
            Tighten within
            <input
              name="criticalWindowDays"
              type="number"
              min={1}
              max={90}
              defaultValue={alertCfg.criticalWindowDays ?? ""}
              placeholder={String(DEFAULT_ALERT_CONFIG.criticalWindowDays)}
              className={`${input} w-28`}
            />
            <span className="text-xs text-stone-400">days of a critical date</span>
          </label>
          <label className={labelCls}>
            Then flag after
            <input
              name="criticalStaleDays"
              type="number"
              min={1}
              max={60}
              defaultValue={alertCfg.criticalStaleDays ?? ""}
              placeholder={String(DEFAULT_ALERT_CONFIG.criticalStaleDays)}
              className={`${input} w-28`}
            />
            <span className="text-xs text-stone-400">business days quiet</span>
          </label>
          <button type="submit" className={btnGhost}>
            Save alert timing
          </button>
        </form>
        <p className="mt-2 text-xs text-stone-400">
          Critical dates, in priority order: closing, mortgage commitment, inspection deadline.
        </p>
      </SectionCard>

      <SectionCard title="Automated emails">
        <p className="mb-3 text-sm text-stone-500">
          Lifecycle emails {client.name} receives automatically. Wording is editable under{" "}
          <Link href="/dashboard/emails" className="text-brand-700 hover:underline">
            Email templates
          </Link>
          .
        </p>
        <form action={saveClientEmailPrefs} className="flex flex-wrap items-center gap-6">
          <input type="hidden" name="id" value={client.id} />
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              name="intro"
              defaultChecked={emailPrefs.intro}
              className="accent-brand-600"
            />
            Intro email (new file opened)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              name="postClose"
              defaultChecked={emailPrefs.postClose}
              className="accent-brand-600"
            />
            Post-close email
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              name="review"
              defaultChecked={emailPrefs.review}
              className="accent-brand-600"
            />
            Review request
          </label>
          <button type="submit" className={`${btnGhost} px-3 py-1.5 text-xs`}>
            Save
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Notes">
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
      </SectionCard>

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
