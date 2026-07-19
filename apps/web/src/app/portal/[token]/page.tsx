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
import { submitIntake } from "@/lib/actions/intake";
import { fmtDate, fmtMoney, ROLE_LABEL, STATUS_LABEL } from "@/lib/format";
import { INTAKE_UPLOAD_HINT, intakeFields } from "@/lib/intake";
import { resolveAgentPortal, resolvePortal } from "@/lib/portal";
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
    <header className="bg-[radial-gradient(100%_140%_at_50%_0%,#0b7a49_0%,#054f30_100%)] pb-14 pt-8 text-white">
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

const intakeInputCls =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";

function IntakeForm({
  token,
  kind,
  heading,
}: {
  token: string;
  kind: "buy" | "sell";
  heading: string;
}) {
  return (
    <details className="rounded-lg border border-stone-200/70">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-brand-800 hover:bg-stone-50">
        {heading}
      </summary>
      <form action={submitIntake} className="flex flex-col gap-3 border-t border-stone-100 p-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="kind" value={kind} />
        <div className="grid gap-3 sm:grid-cols-2">
          {intakeFields(kind).map((f) =>
            f.type === "textarea" ? (
              <label
                key={f.id}
                className="flex flex-col gap-1 text-sm font-medium text-stone-700 sm:col-span-2"
              >
                {f.label}
                {f.required ? " *" : ""}
                <textarea
                  name={`f_${f.id}`}
                  rows={3}
                  placeholder={f.placeholder}
                  className={intakeInputCls}
                />
              </label>
            ) : (
              <label key={f.id} className="flex flex-col gap-1 text-sm font-medium text-stone-700">
                {f.label}
                {f.required ? " *" : ""}
                <input
                  name={`f_${f.id}`}
                  type={f.type ?? "text"}
                  required={f.required}
                  placeholder={f.placeholder}
                  className={intakeInputCls}
                />
              </label>
            ),
          )}
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
          Documents
          <input
            type="file"
            name="files"
            multiple
            className="text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
          />
          <span className="text-xs font-normal text-stone-400">
            {INTAKE_UPLOAD_HINT[kind]} Up to 5 files, 10&nbsp;MB each.
          </span>
        </label>
        <button
          type="submit"
          className="self-start rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          Submit
        </button>
      </form>
    </details>
  );
}

/* ---------------- Buyer & Seller portal ---------------- */

function ClientPortal(
  portal: NonNullable<Awaited<ReturnType<typeof resolvePortal>>>,
  labels: SideLabels,
  intakeDone: boolean,
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
    <main className="min-h-screen bg-stone-50">
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

        {link.showIntake && (
          <section className={cardCls}>
            <h2 className="mb-1 font-medium">Intake forms</h2>
            <p className="mb-3 text-sm text-stone-500">
              A few details {tenantName} needs to keep your closing moving — takes about five
              minutes, and you can attach documents as you go.
            </p>
            {intakeDone ? (
              <p className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
                Thank you — your intake form is in. {tenantName} has been notified and will follow
                up if anything else is needed.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {(txn.side === "BUY_SIDE" || txn.side === "DUAL") && (
                  <IntakeForm token={link.token} kind="buy" heading={`${labels.buy} intake form`} />
                )}
                {(txn.side === "SELL_SIDE" || txn.side === "DUAL") && (
                  <IntakeForm
                    token={link.token}
                    kind="sell"
                    heading={`${labels.sell} intake form`}
                  />
                )}
              </div>
            )}
          </section>
        )}

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
    <main className="min-h-screen bg-stone-50">
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
  searchParams: Promise<{ q?: string; intake?: string }>;
}) {
  const { token } = await params;
  const { q, intake } = await searchParams;

  const clientPortal = await resolvePortal(token);
  if (clientPortal) {
    const labels = await tenantSideLabels(clientPortal.link.tenantId);
    return ClientPortal(clientPortal, labels, intake === "done");
  }

  const agentPortal = await resolveAgentPortal(token);
  if (agentPortal) return AgentPortal(agentPortal, q ?? "");

  notFound();
}
