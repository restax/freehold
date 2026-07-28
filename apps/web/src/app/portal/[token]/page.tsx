import { withTenant } from "@freehold/db";
import {
  Archive,
  CalendarCheck,
  ChartLineUp,
  Check,
  FileText,
  Lifebuoy,
  ListChecks,
  MapPin,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/badges";
import { FormBody } from "@/components/form-render";
import { placeClientOrder } from "@/lib/actions/portal-orders";
import { submitPortalForm } from "@/lib/actions/public-forms";
import { type Appearance, portalVars, tenantAppearance } from "@/lib/appearance";
import { portalFormsFor, trimKnownClientFields } from "@/lib/form-resolve";
import { parseLayout } from "@/lib/form-schema";
import { fmtDate, fmtMoney, ROLE_LABEL, STATUS_LABEL } from "@/lib/format";
import { resolveAgentPortal, resolvePortal } from "@/lib/portal";
import { type PortalVendorData, portalVendorData } from "@/lib/portal-vendors";
import { type SideLabels, sideLabel, tenantSideLabels } from "@/lib/side-labels";

export const dynamic = "force-dynamic";

const cardCls =
  "rounded-xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)]";

function PortalHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header
      className="pb-14 pt-8 text-white"
      style={{
        background:
          "radial-gradient(100% 140% at 50% 0%, var(--portal-accent) 0%, var(--portal-accent-dark) 100%)",
      }}
    >
      <div className="mx-auto flex max-w-3xl items-start justify-between px-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-200">
            {eyebrow}
          </p>
          <h1 className="font-display mt-2 text-balance text-3xl font-extrabold tracking-tight md:text-4xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-brand-50/80">{subtitle}</p>}
        </div>
        <span
          title="Questions? Ask your transaction coordinator."
          className="mt-1 text-brand-50/70"
        >
          <Lifebuoy size={22} weight="duotone" aria-hidden />
        </span>
      </div>
    </header>
  );
}

/* ---------------- Buyer & Seller portal ---------------- */

const portalInputCls =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";

const ORDER_STATUS_TONE: Record<string, string> = {
  SENT: "bg-stone-100 text-stone-600",
  ACCEPTED: "bg-amber-100 text-amber-800",
  SCHEDULED: "bg-brand-100 text-brand-800",
  COMPLETED: "bg-brand-600 text-white",
  DECLINED: "bg-red-100 text-red-700",
  CANCELLED: "bg-stone-100 text-stone-400",
};

function fmtApptDate(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/** A designed form placed in portals, as the portal needs it. */
type PortalForm = {
  id: string;
  title: string;
  description: string | null;
  layout: unknown;
  clientId: string | null;
};

/**
 * Designed intake forms in the portal. The client is already known here, so
 * the questions that only establish who they are get dropped — they are not
 * asked to retype their own name. Everything about the deal is still asked.
 */
function PortalForms({
  forms,
  token,
  sent,
  cardCls,
}: {
  forms: PortalForm[];
  token: string;
  sent: boolean;
  cardCls: string;
}) {
  if (forms.length === 0) return null;
  return (
    <>
      {forms.map((f) => {
        // A form that only ever asked who they are has nothing left to ask.
        const trimmed = trimKnownClientFields(parseLayout(f.layout));
        if (!trimmed) return null;
        return (
          <section key={f.id} className={cardCls}>
            <h2 className="mb-1 font-medium">{f.title}</h2>
            {f.description && <p className="mb-3 text-sm text-stone-500">{f.description}</p>}
            {sent ? (
              <p className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
                Thank you — that's with your coordinator now.
              </p>
            ) : (
              <form action={submitPortalForm} className="flex flex-col gap-4">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="formId" value={f.id} />
                <FormBody layout={trimmed} />
                <div>
                  <button
                    type="submit"
                    className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-brand-600 active:scale-[0.99]"
                  >
                    Send
                  </button>
                </div>
              </form>
            )}
          </section>
        );
      })}
    </>
  );
}

function ClientPortal(
  portal: NonNullable<Awaited<ReturnType<typeof resolvePortal>>>,
  labels: SideLabels,
  vendorData: PortalVendorData | null,
  appearance: Appearance,
  portalForms: PortalForm[],
  formSent: boolean,
) {
  const { link, txn, tenantName } = portal;
  const today = fmtDate(new Date());

  // The other side's agent stays out of the directory.
  const excludedRole =
    txn.side === "BUY_SIDE" ? "LISTING_AGENT" : txn.side === "SELL_SIDE" ? "BUYER_AGENT" : null;
  const parties = txn.parties.filter((p) => p.role !== excludedRole);

  type Milestone = { key: string; title: string; date: string | null; done: boolean };
  const milestones: Milestone[] = [];
  if (txn.contractDate) {
    milestones.push({
      key: "contract",
      title: "Under contract",
      date: fmtDate(txn.contractDate),
      done: true,
    });
  }
  for (const t of txn.tasks) {
    milestones.push({
      key: t.id,
      title: t.title,
      date: t.dueDate ? fmtDate(t.dueDate) : null,
      done: t.status === "DONE",
    });
  }
  if (txn.closeDate) {
    milestones.push({
      key: "closing",
      title: "Closing day",
      date: fmtDate(txn.closeDate),
      done: txn.status === "CLOSED",
    });
  }
  const upcoming = milestones.filter((m) => !m.done);
  const completed = milestones.filter((m) => m.done);

  return (
    <main
      className="min-h-screen bg-stone-50"
      style={{ ...portalVars(appearance), fontFamily: "var(--font-sans)" }}
    >
      <PortalHeader
        eyebrow={`${txn.client?.name ?? tenantName} · your transaction`}
        title={txn.propertyAddress}
        subtitle={[txn.city, txn.state, txn.zip].filter(Boolean).join(", ")}
      />

      <div className="mx-auto -mt-8 flex max-w-3xl flex-col gap-5 px-4 pb-10">
        <section className={cardCls}>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="mb-1 text-xs uppercase tracking-wide text-stone-400">Status</dt>
              <dd>
                <StatusBadge status={txn.status} />
              </dd>
            </div>
            <div>
              <dt className="mb-1 text-xs uppercase tracking-wide text-stone-400">Side</dt>
              <dd className="font-medium">{sideLabel(txn.side, labels)}</dd>
            </div>
            <div>
              <dt className="mb-1 text-xs uppercase tracking-wide text-stone-400">Closing date</dt>
              <dd className="flex items-center gap-1.5 font-medium tabular-nums">
                <CalendarCheck size={15} weight="fill" className="text-brand-600" aria-hidden />
                {fmtDate(txn.closeDate)}
              </dd>
            </div>
            <div>
              <dt className="mb-1 text-xs uppercase tracking-wide text-stone-400">Price</dt>
              <dd className="font-medium tabular-nums">{fmtMoney(txn.purchasePrice)}</dd>
            </div>
          </dl>
        </section>

        {link.showTasks && milestones.length > 0 && (
          <section className={cardCls}>
            <h2 className="mb-4 flex items-center gap-2 font-medium">
              <ListChecks size={17} weight="bold" className="text-brand-600" aria-hidden />
              Your journey
            </h2>
            {upcoming.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Coming up
                </h3>
                <ol className="relative flex flex-col gap-3 border-l-2 border-stone-100 pl-5">
                  {upcoming.map((m) => {
                    const overdue = m.date && m.date < today;
                    return (
                      <li key={m.key} className="relative text-sm">
                        <span
                          aria-hidden
                          className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-stone-300 bg-white"
                        />
                        <span className="font-medium">{m.title}</span>
                        {m.date && (
                          <span
                            className={`ml-2 tabular-nums ${overdue ? "font-medium text-red-600" : "text-stone-400"}`}
                          >
                            {m.date}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
            {completed.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Completed
                </h3>
                <ol className="relative flex flex-col gap-3 border-l-2 border-brand-100 pl-5">
                  {completed.map((m) => (
                    <li key={m.key} className="relative text-sm text-stone-500">
                      <span
                        aria-hidden
                        className="absolute -left-[29px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-brand-600 text-white"
                      >
                        <Check size={10} weight="bold" aria-hidden />
                      </span>
                      <span>{m.title}</span>
                      {m.date && <span className="ml-2 tabular-nums text-stone-400">{m.date}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        )}

        {link.showParties && parties.length > 0 && (
          <section className={cardCls}>
            <h2 className="mb-3 flex items-center gap-2 font-medium">
              <UsersThree size={17} weight="bold" className="text-brand-600" aria-hidden />
              Your team
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {parties.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="w-32 shrink-0 text-stone-500">{ROLE_LABEL[p.role]}</span>
                  <span className="font-medium">{p.contact.name}</span>
                  <span className="text-stone-500">{p.contact.email ?? p.contact.phone ?? ""}</span>
                  {p.role === "TITLE_COMPANY" && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.contact.name)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                    >
                      <MapPin size={13} weight="fill" aria-hidden />
                      Map for closing day
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {link.showDocuments && txn.documents.length > 0 && (
          <section className={cardCls}>
            <h2 className="mb-3 flex items-center gap-2 font-medium">
              <FileText size={17} weight="bold" className="text-brand-600" aria-hidden />
              Your documents
            </h2>
            <ul className="flex flex-col gap-1 text-sm">
              {txn.documents.map((d) => (
                <li key={d.id}>
                  <a
                    href={`/portal/${link.token}/documents/${d.id}`}
                    className="text-brand-600 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {d.filename}
                  </a>{" "}
                  <span className="text-xs text-stone-400">
                    ({(d.sizeBytes / 1024).toFixed(0)} KB)
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {link.showVendorOrders && vendorData && (
          <section className={cardCls}>
            <h2 className="mb-1 flex items-center gap-2 font-medium">
              <CalendarCheck size={17} weight="bold" className="text-brand-600" aria-hidden />
              Services
            </h2>
            <p className="mb-3 text-sm text-stone-500">
              Order a service for your transaction. {tenantName} sees it right away, and any
              appointment shows up here.
            </p>

            {vendorData.orders.length > 0 && (
              <ul className="mb-4 flex flex-col gap-2">
                {vendorData.orders.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-100 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{o.type}</span>
                    {o.vendorName && <span className="text-stone-500">· {o.vendorName}</span>}
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_TONE[o.status] ?? ""}`}
                    >
                      {o.status.toLowerCase()}
                    </span>
                    {o.status === "SCHEDULED" && o.scheduledAt && (
                      <span className="text-brand-700">
                        appointment {fmtApptDate(o.scheduledAt)}
                      </span>
                    )}
                    {o.status === "ACCEPTED" && o.missedAt && (
                      <span className="text-red-600">appointment missed — being rescheduled</span>
                    )}
                    {o.placedByClient && (
                      <span className="text-xs text-stone-400">ordered by you</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {vendorData.connectedVendors.length > 0 ? (
              <form
                action={placeClientOrder}
                className="flex flex-wrap items-end gap-3 border-t border-stone-100 pt-3"
              >
                <input type="hidden" name="token" value={link.token} />
                <label className="flex flex-col gap-1 text-sm">
                  Vendor
                  <select name="vendorId" required className={portalInputCls}>
                    {vendorData.connectedVendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  What you need
                  <input
                    name="type"
                    required
                    placeholder="Home inspection"
                    className={portalInputCls}
                  />
                </label>
                <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
                  Details
                  <input
                    name="details"
                    placeholder="Anything they should know"
                    className={portalInputCls}
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
                >
                  Place order
                </button>
              </form>
            ) : (
              <p className="border-t border-stone-100 pt-3 text-sm text-stone-400">
                {tenantName} hasn't connected any vendors yet — check back soon.
              </p>
            )}
          </section>
        )}

        <PortalForms forms={portalForms} token={link.token} sent={formSent} cardCls={cardCls} />

        <p className="text-center text-xs text-stone-400">
          <a
            href={`/portal/${link.token}/calendar.ics`}
            className="font-medium text-brand-700 hover:underline"
          >
            Subscribe to these dates
          </a>{" "}
          in Google Calendar, Outlook, or Apple Calendar — changes sync automatically.
        </p>
        <footer className="mt-2 text-center text-xs text-stone-400">
          Prepared by {tenantName} · read-only view · powered by{" "}
          <a
            href="https://freeholdtc.dev"
            className="font-medium text-stone-500 hover:text-brand-700"
          >
            Freehold
          </a>
        </footer>
      </div>
    </main>
  );
}

/* ---------------- Managed Agent portal ---------------- */

const PIPELINE_ORDER = ["UNDER_CONTRACT", "PENDING", "LISTING", "CLOSED"] as const;

function AgentPortal(
  portal: NonNullable<Awaited<ReturnType<typeof resolveAgentPortal>>>,
  q: string,
  appearance: Appearance,
) {
  const { link, client, transactions, recentTasks, recentDocs, tenantName } = portal;

  const active = transactions.filter((t) => t.status !== "CLOSED" && t.status !== "CANCELLED");
  const closed = transactions.filter((t) => t.status === "CLOSED");
  const byStatus = (s: string) => transactions.filter((t) => t.status === s).length;

  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const closedThisYear = closed.filter((t) => t.closeDate && t.closeDate >= yearStart).length;
  const daysElapsed = Math.max(1, (Date.now() - yearStart.getTime()) / 86400000);
  const projected = Math.round((closedThisYear / daysElapsed) * 365);

  const archive = closed.filter((t) =>
    q ? t.propertyAddress.toLowerCase().includes(q.toLowerCase()) : true,
  );

  const activity = [
    ...recentTasks.map((t) => ({
      key: `task-${t.id}`,
      at: t.completedAt as Date,
      text: `Completed: ${t.title}`,
      where: t.transaction,
    })),
    ...recentDocs.map((d) => ({
      key: `doc-${d.id}`,
      at: d.createdAt,
      text: `New document: ${d.filename}`,
      where: d.transaction,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 15);

  return (
    <main
      className="min-h-screen bg-stone-50"
      style={{ ...portalVars(appearance), fontFamily: "var(--font-sans)" }}
    >
      <PortalHeader
        eyebrow={`${tenantName} · agent portal`}
        title={client.name}
        subtitle="Every deal your coordinator is running for you, live."
      />

      <div className="mx-auto -mt-8 flex max-w-3xl flex-col gap-5 px-4 pb-10">
        <section className={cardCls}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {PIPELINE_ORDER.map((s) => (
              <div key={s}>
                <p className="font-serif text-3xl font-semibold tabular-nums leading-none">
                  {byStatus(s)}
                </p>
                <p className="mt-1 text-xs text-stone-500">{STATUS_LABEL[s]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`${cardCls} flex items-center gap-4`}>
          <ChartLineUp size={28} weight="duotone" className="shrink-0 text-brand-600" aria-hidden />
          <p className="text-sm leading-relaxed text-stone-600">
            {closedThisYear > 0 ? (
              <>
                <strong className="font-semibold text-stone-900">{closedThisYear} closed</strong> so
                far this year — at this pace you're on track for{" "}
                <strong className="font-semibold text-brand-700">about {projected} closings</strong>{" "}
                in {new Date().getUTCFullYear()}.
              </>
            ) : (
              <>No closings recorded yet this year — the projection appears after your first.</>
            )}
          </p>
        </section>

        <section className={cardCls}>
          <h2 className="mb-3 font-medium">Next 30 days</h2>
          {portal.upcoming.length === 0 ? (
            <p className="text-sm text-stone-500">No dated items in the next month.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {portal.upcoming.map((u) => (
                <li key={u.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-stone-400">
                    {fmtDate(u.dueDate)}
                  </span>
                  <span>{u.title}</span>
                  {u.transaction && (
                    <Link
                      href={`/portal/${link.token}/t/${u.transaction.id}`}
                      className="text-xs text-brand-700 hover:underline"
                    >
                      {u.transaction.propertyAddress}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cardCls}>
          <h2 className="mb-3 font-medium">Active transactions</h2>
          {active.length === 0 ? (
            <p className="text-sm text-stone-500">Nothing in flight right now.</p>
          ) : (
            <ul className="flex flex-col">
              {active.map((t) => (
                <li key={t.id} className="border-b border-stone-100 py-2.5 last:border-0">
                  <Link
                    href={`/portal/${link.token}/t/${t.id}`}
                    className="flex flex-wrap items-center gap-3"
                  >
                    <span className="font-medium text-brand-700 hover:underline">
                      {t.propertyAddress}
                    </span>
                    <StatusBadge status={t.status} />
                    <span className="text-sm text-stone-500">{fmtMoney(t.purchasePrice)}</span>
                    {t.closeDate && (
                      <span className="ml-auto text-sm tabular-nums text-stone-500">
                        closes {fmtDate(t.closeDate)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cardCls}>
          <h2 className="mb-3 font-medium">Last 7 days</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-stone-500">Quiet week so far — updates land here.</p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto text-sm">
              {activity.map((a) => (
                <li key={a.key} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-xs tabular-nums text-stone-400">
                    {fmtDate(a.at)}
                  </span>
                  <span>{a.text}</span>
                  {a.where && (
                    <Link
                      href={`/portal/${link.token}/t/${a.where.id}`}
                      className="text-xs text-brand-700 hover:underline"
                    >
                      {a.where.propertyAddress}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cardCls}>
          <h2 className="mb-3 flex items-center gap-2 font-medium">
            <Archive size={17} weight="bold" className="text-brand-600" aria-hidden />
            Closed &amp; archived
          </h2>
          <form method="GET" className="mb-3 flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search past addresses…"
              className="flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              Search
            </button>
          </form>
          {archive.length === 0 ? (
            <p className="text-sm text-stone-500">
              {q ? "No closed transactions match." : "Closed transactions collect here."}
            </p>
          ) : (
            <ul className="flex flex-col text-sm">
              {archive.map((t) => (
                <li key={t.id} className="border-b border-stone-100 py-2 last:border-0">
                  <Link
                    href={`/portal/${link.token}/t/${t.id}`}
                    className="flex flex-wrap items-center gap-3"
                  >
                    <span className="font-medium text-brand-700 hover:underline">
                      {t.propertyAddress}
                    </span>
                    <span className="text-stone-500">{fmtMoney(t.purchasePrice)}</span>
                    <span className="ml-auto tabular-nums text-stone-400">
                      closed {fmtDate(t.closeDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-center text-xs text-stone-400">
          <a
            href={`/portal/${link.token}/calendar.ics`}
            className="font-medium text-brand-700 hover:underline"
          >
            Subscribe to all your dates
          </a>{" "}
          in Google Calendar, Outlook, or Apple Calendar — changes sync automatically.
        </p>
        <footer className="mt-2 text-center text-xs text-stone-400">
          Coordinated by {tenantName} · powered by{" "}
          <a
            href="https://freeholdtc.dev"
            className="font-medium text-stone-500 hover:text-brand-700"
          >
            Freehold
          </a>
        </footer>
      </div>
    </main>
  );
}

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ q?: string; formSent?: string; formInvalid?: string }>;
}) {
  const { token } = await params;
  const { q, formSent } = await searchParams;

  const clientPortal = await resolvePortal(token);
  if (clientPortal) {
    const [labels, appearance, vendorData, portalForms] = await Promise.all([
      tenantSideLabels(clientPortal.link.tenantId),
      tenantAppearance(clientPortal.link.tenantId),
      clientPortal.link.showVendorOrders
        ? portalVendorData(clientPortal.link.tenantId, clientPortal.txn.id)
        : Promise.resolve(null),
      // Forms the workspace placed in portals — the client's own version of
      // one wins over the shared version (lib/form-resolve.ts).
      withTenant(clientPortal.link.tenantId, async (tx) =>
        portalFormsFor(
          await tx.form.findMany({ where: { status: "published", showPortal: true } }),
          clientPortal.txn.clientId,
        ),
      ),
    ]);
    return ClientPortal(
      clientPortal,
      labels,
      vendorData,
      appearance,
      portalForms,
      Boolean(formSent),
    );
  }

  const agentPortal = await resolveAgentPortal(token);
  if (agentPortal) {
    const appearance = await tenantAppearance(agentPortal.link.tenantId);
    return AgentPortal(agentPortal, q ?? "", appearance);
  }

  notFound();
}
