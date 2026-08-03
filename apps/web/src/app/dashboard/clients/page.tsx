import { ClientType, EsignProvider, prisma, withTenant } from "@freehold/db";
import { Buildings, Storefront, User, UserPlus, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Fragment } from "react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Badge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { PhoneInput } from "@/components/phone-input";
import { SectionCard } from "@/components/section-card";
import { createClient, updateClientEsign } from "@/lib/actions/clients";
import {
  brokerageInfoFrom,
  CLIENT_TYPE_LABEL,
  type ClientKind,
  clientKind,
} from "@/lib/client-profile";
import { requireTenant } from "@/lib/tenant";
import {
  btn,
  btnGhost,
  card,
  fieldGroupLabel,
  input,
  label,
  tableWrap,
  td,
  th,
  trHover,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

const TYPE_ICON: Record<string, typeof Buildings> = {
  AGENT: User,
  BROKERAGE: Buildings,
  TEAM: UsersThree,
  TITLE: Storefront,
  LENDER: Storefront,
  OTHER: Storefront,
};

/**
 * The list reads in the same split the create flow asks about: offices with
 * rosters, individual agents, then everyone else.
 */
const GROUPS: Array<{ kind: ClientKind; label: string; icon: typeof Buildings }> = [
  { kind: "office", label: "Brokerages & teams", icon: Buildings },
  { kind: "individual", label: "Individual agents", icon: User },
  { kind: "company", label: "Companies", icon: Storefront },
];

const ESIGN_LABEL: Record<string, string> = {
  MANUAL: "Manual / outside Freehold",
  DOCUMENSO: "Documenso",
  DOCUSIGN: "DocuSign",
  OPENSIGN: "OpenSign",
};

/**
 * The three creation paths. "Who is this client?" comes first because the
 * answer changes every question after it: an individual agent needs their
 * broker on file; an office needs a billing contact and a roster of agents.
 */
const PATHS = [
  {
    key: "agent",
    icon: User,
    title: "Individual agent",
    blurb: "One agent — you'll keep their broker's details on file.",
  },
  {
    key: "office",
    icon: Buildings,
    title: "Brokerage or team",
    blurb: "An office with its own agents and a billing contact.",
  },
  {
    key: "company",
    icon: Storefront,
    title: "Other company",
    blurb: "Title company, lender, or anyone else you coordinate for.",
  },
] as const;

type PathKey = (typeof PATHS)[number]["key"];

function EsignField() {
  return (
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
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const { new: newParam } = await searchParams;
  const path: PathKey | null = PATHS.some((p) => p.key === newParam) ? (newParam as PathKey) : null;

  const clients = await withTenant(tenantId, (tx) =>
    tx.client.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { transactions: true, agents: true } } },
    }),
  );
  const hasSampleData = path
    ? (
        await prisma.organization.findUnique({
          where: { id: tenantId },
          select: { hasSampleData: true },
        })
      )?.hasSampleData
    : false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Clients</h1>
          <p className="text-sm text-stone-500">
            The agents, brokerages, and companies you coordinate transactions for.
          </p>
        </div>
        {!path && (
          <Link href="/dashboard/clients?new=agent" className={btn}>
            + New client
          </Link>
        )}
      </div>

      {path && (
        <SectionCard
          tour="clients-new"
          title="New client"
          icon={<UserPlus size={15} weight="fill" aria-hidden />}
          action={
            <Link href="/dashboard/clients" className="text-xs text-stone-500 hover:text-stone-800">
              Cancel
            </Link>
          }
        >
          {hasSampleData && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              This workspace still has sample data. What you add here is real and separate from it,
              so consider removing the sample data first, before your team has to tell them apart.
            </p>
          )}
          <p className="mb-3 text-sm text-stone-500">Who is this client?</p>

          <div className="grid gap-2 sm:grid-cols-3">
            {PATHS.map((p) => {
              const active = p.key === path;
              const Icon = p.icon;
              return (
                <Link
                  key={p.key}
                  href={`/dashboard/clients?new=${p.key}`}
                  aria-current={active ? "true" : undefined}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    active
                      ? "border-brand-600 bg-brand-50/60"
                      : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  <Icon
                    size={20}
                    weight={active ? "fill" : "regular"}
                    className={`mt-0.5 shrink-0 ${active ? "text-brand-700" : "text-stone-400"}`}
                  />
                  <span className="flex flex-col">
                    <span
                      className={`text-sm font-medium ${active ? "text-brand-900" : "text-stone-700"}`}
                    >
                      {p.title}
                    </span>
                    <span className="text-xs text-stone-500">{p.blurb}</span>
                  </span>
                </Link>
              );
            })}
          </div>

          {path === "agent" && (
            <form action={createClient} className="mt-4 flex flex-col gap-4">
              <input type="hidden" name="type" value={ClientType.AGENT} />
              <div>
                <p className={fieldGroupLabel}>The agent</p>
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className={label}>
                    Name *
                    <input name="name" required className={input} placeholder="Priya Raman" />
                  </label>
                  <label className={label}>
                    Email
                    <input name="email" type="email" className={input} />
                  </label>
                  <label className={label}>
                    Phone
                    <PhoneInput name="phone" className={input} />
                  </label>
                  <EsignField />
                </div>
              </div>
              <div className="border-t border-stone-100 pt-3">
                <p className={fieldGroupLabel}>Their brokerage</p>
                <p className="mb-2 text-xs text-stone-400">
                  Where they hang their license — reference info for your file, not a client record.
                </p>
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_2fr]">
                  <label className={label}>
                    Brokerage name
                    <input name="brokerageName" className={input} placeholder="Harborline Realty" />
                  </label>
                  <label className={label}>
                    Brokerage phone
                    <input name="brokeragePhone" className={input} />
                  </label>
                  <AddressAutocomplete name="brokerageAddress" label="Brokerage address" />
                </div>
              </div>
              <div className="border-t border-stone-100 pt-3">
                <button type="submit" className={btn}>
                  Add agent client
                </button>
              </div>
            </form>
          )}

          {path === "office" && (
            <form action={createClient} className="mt-4 flex flex-col gap-4">
              <div>
                <p className={fieldGroupLabel}>The office</p>
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className={label}>
                    Office name *
                    <input name="name" required className={input} placeholder="Harborline Realty" />
                  </label>
                  <label className={label}>
                    Type
                    <select name="type" className={input} defaultValue={ClientType.BROKERAGE}>
                      <option value={ClientType.BROKERAGE}>Brokerage</option>
                      <option value={ClientType.TEAM}>Team</option>
                    </select>
                  </label>
                  <label className={label}>
                    Office phone
                    <PhoneInput name="phone" className={input} />
                  </label>
                  <label className={label}>
                    Office email
                    <input name="email" type="email" className={input} />
                  </label>
                  <div className="sm:col-span-2">
                    <AddressAutocomplete name="address" label="Office address" />
                  </div>
                  <EsignField />
                </div>
              </div>
              <div className="border-t border-stone-100 pt-3">
                <p className={fieldGroupLabel}>Billing contact</p>
                <p className="mb-2 text-xs text-stone-400">
                  Who pays the bills. Invoices email the billing contact when one is set, the office
                  email otherwise.
                </p>
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className={label}>
                    Name
                    <input name="billingName" className={input} placeholder="Dana Whitfield" />
                  </label>
                  <label className={label}>
                    Email
                    <input name="billingEmail" type="email" className={input} />
                  </label>
                  <label className={label}>
                    Phone
                    <input name="billingPhone" className={input} />
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3">
                <button type="submit" className={btn}>
                  Add office
                </button>
                <span className="flex items-center gap-1.5 text-xs text-stone-400">
                  <UsersThree size={14} />
                  You'll add the individual agents on the office's page next.
                </span>
              </div>
            </form>
          )}

          {path === "company" && (
            <form action={createClient} className="mt-4 flex flex-col gap-4">
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className={label}>
                  Name *
                  <input name="name" required className={input} placeholder="Lakeview Title Co." />
                </label>
                <label className={label}>
                  Type
                  <select name="type" className={input} defaultValue={ClientType.TITLE}>
                    <option value={ClientType.TITLE}>Title company</option>
                    <option value={ClientType.LENDER}>Lender</option>
                    <option value={ClientType.OTHER}>Other</option>
                  </select>
                </label>
                <label className={label}>
                  Email
                  <input name="email" type="email" className={input} />
                </label>
                <label className={label}>
                  Phone
                  <PhoneInput name="phone" className={input} />
                </label>
                <EsignField />
              </div>
              <div className="border-t border-stone-100 pt-3">
                <button type="submit" className={btn}>
                  Add client
                </button>
              </div>
            </form>
          )}
        </SectionCard>
      )}

      <section className={card}>
        {clients.length === 0 ? (
          <EmptyState
            title="No clients yet"
            hint='Clients are who you coordinate for — an agent, a brokerage, a title company. Each transaction belongs to one, and their preferences (like e-sign provider) follow automatically. Hit "+ New client" above to add your first.'
          />
        ) : (
          <div data-tour="clients-table" className={tableWrap}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>Name</th>
                  <th className={th}>Type</th>
                  <th className={th}>Contact</th>
                  <th className={th}>Agents</th>
                  <th className={th}>Transactions</th>
                  <th className={th}>E-sign</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {GROUPS.map((g) => {
                  const members = clients.filter((c) => clientKind(c.type) === g.kind);
                  if (members.length === 0) return null;
                  const GroupIcon = g.icon;
                  return (
                    <Fragment key={g.kind}>
                      <tr>
                        <td
                          colSpan={7}
                          className="border-b border-stone-200 bg-stone-50 px-2.5 py-1.5"
                        >
                          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
                            <GroupIcon size={13} className="text-stone-400" aria-hidden />
                            {g.label}
                            <span className="font-normal text-stone-400">{members.length}</span>
                          </span>
                        </td>
                      </tr>
                      {members.map((c) => {
                        const kind = clientKind(c.type);
                        const RowIcon = TYPE_ICON[c.type] ?? Storefront;
                        const subline =
                          kind === "office"
                            ? c.address
                            : kind === "individual"
                              ? brokerageInfoFrom(c.brokerageInfo)?.name
                              : null;
                        return (
                          <tr key={c.id} className={trHover}>
                            <td className={`${td} font-medium`}>
                              <span className="flex items-center gap-2">
                                <RowIcon
                                  size={15}
                                  weight="duotone"
                                  className="shrink-0 text-brand-600/70"
                                  aria-hidden
                                />
                                <span className="flex flex-col">
                                  <Link
                                    href={`/dashboard/clients/${c.id}`}
                                    className="text-brand-700 hover:text-brand-600 hover:underline"
                                  >
                                    {c.name}
                                  </Link>
                                  {subline && (
                                    <span className="text-xs font-normal text-stone-400">
                                      {subline}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </td>
                            <td className={td}>
                              <Badge tone={kind === "office" ? "attention" : "neutral"}>
                                {CLIENT_TYPE_LABEL[c.type]}
                              </Badge>
                            </td>
                            <td className={td}>
                              {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                            </td>
                            <td className={td}>
                              {kind === "office" ? (
                                c._count.agents > 0 ? (
                                  <span className="flex items-center gap-1.5">
                                    <UsersThree size={14} className="text-stone-400" aria-hidden />
                                    {c._count.agents}
                                  </span>
                                ) : (
                                  <Link
                                    href={`/dashboard/clients/${c.id}`}
                                    className="whitespace-nowrap text-xs text-brand-700 hover:underline"
                                  >
                                    add agents →
                                  </Link>
                                )
                              ) : (
                                <span className="text-stone-300">—</span>
                              )}
                            </td>
                            <td className={td}>{c._count.transactions}</td>
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
                            <td className={td}>
                              <Link
                                href={`/dashboard/clients/${c.id}`}
                                className="whitespace-nowrap text-xs text-brand-700 hover:underline"
                              >
                                Open →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
