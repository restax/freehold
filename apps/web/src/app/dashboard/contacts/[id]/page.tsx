import { withTenant } from "@freehold/db";
import { EnvelopeSimple, Phone, UserCircle, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/badges";
import { DangerDelete } from "@/components/danger-delete";
import { HandbookGradeControl } from "@/components/handbook-grade";
import { HandbookNotes } from "@/components/handbook-notes";
import { RevealCredential } from "@/components/reveal-credential";
import { SectionCard } from "@/components/section-card";
import { addContactNote, deleteContact, logTouch, scheduleFollowUp } from "@/lib/actions/contacts";
import { toggleTask } from "@/lib/actions/tasks";
import { createCredential } from "@/lib/actions/vault";
import {
  type Address,
  fmtMonthDay,
  GRADE_CADENCE,
  type PersonFields,
  SOCIAL_LABELS,
  type SocialLinks,
  TOUCH_DATE_LABELS,
  type TouchDates,
} from "@/lib/crm";
import { fmtDate, fmtMoney } from "@/lib/format";
import { handbookState } from "@/lib/plans";
import { getMemberRole, requireTenant } from "@/lib/tenant";
import {
  btn,
  btnGhost,
  card,
  input,
  label as labelCls,
  tableWrap,
  td,
  th,
  trHover,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

const TABS = [
  ["recent", "Recent"],
  ["transactions", "Transactions"],
  ["notes", "Notes"],
  ["tasks", "Tasks"],
  ["credentials", "Credentials"],
  ["touch-dates", "Touch dates"],
  ["addresses", "Addresses"],
  ["details", "Other details"],
] as const;
type Tab = (typeof TABS)[number][0];

function AddressBlock({ title, a }: { title: string; a: Address | null }) {
  if (!a) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">{title}</h3>
      <p className="text-sm leading-relaxed">
        {a.line1}
        {a.line2 ? <>, {a.line2}</> : null}
        <br />
        {[a.city, a.state, a.zip].filter(Boolean).join(", ")}
      </p>
    </div>
  );
}

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tenantId, userId } = await requireTenant();
  const { id } = await params;
  const { tab: tabRaw } = await searchParams;
  const tab: Tab = (TABS.some(([t]) => t === tabRaw) ? tabRaw : "recent") as Tab;

  const hb = await handbookState(tenantId);
  const role = await getMemberRole(tenantId, userId);
  const canGrade = role === "owner" || role === "admin";
  const handbookNotes = hb.notes
    ? await withTenant(tenantId, (tx) =>
        tx.handbookNote.findMany({
          where: { subjectType: "CONTACT", subjectId: id },
          orderBy: { createdAt: "desc" },
        }),
      )
    : [];

  const contact = await withTenant(tenantId, (tx) =>
    tx.contact.findUnique({
      where: { id },
      include: {
        referredBy: { select: { id: true, name: true } },
        credentials: {
          orderBy: { system: "asc" },
          select: {
            id: true,
            system: true,
            username: true,
            url: true,
            client: { select: { name: true } },
          },
        },
        agentOf: { include: { client: { select: { id: true, name: true } } } },
        portalLinks: {
          orderBy: { createdAt: "desc" },
          include: { client: { select: { name: true } } },
        },
        contactNotes: { orderBy: { createdAt: "desc" }, take: 50 },
        owners: { include: { user: { select: { name: true } } } },
        tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }], take: 50 },
        parties: {
          include: {
            transaction: {
              select: {
                id: true,
                propertyAddress: true,
                status: true,
                purchasePrice: true,
                closeDate: true,
              },
            },
          },
        },
      },
    }),
  );
  if (!contact) notFound();

  const ownerNames = contact.owners.map((o) => o.user.name);

  const secondary = contact.secondary as PersonFields | null;
  const socialRaw = contact.socialLinks as SocialLinks | null;
  const social = socialRaw && Object.values(socialRaw).some(Boolean) ? socialRaw : null;
  const touchDates = (contact.touchDates as TouchDates | null) ?? {};
  const lead = (contact.leadDetails as Record<string, string> | null) ?? null;
  const transactions = Array.from(
    new Map(contact.parties.map((p) => [p.transaction.id, p.transaction])).values(),
  );
  const dueForTouch = contact.nextTouchAt && fmtDate(contact.nextTouchAt) <= fmtDate(new Date());

  const recent = [
    ...contact.contactNotes.map((n) => ({
      key: `n-${n.id}`,
      at: n.createdAt,
      text: n.body,
      kind: "note" as const,
    })),
    ...contact.tasks.map((t) => ({
      key: `t-${t.id}`,
      at: t.completedAt ?? t.createdAt,
      text: `${t.status === "DONE" ? "Done" : "Task"}: ${t.title}`,
      kind: "task" as const,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 20);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/dashboard/contacts" className="text-sm text-stone-500 hover:underline">
          ← Contacts
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2.5 text-xl font-semibold">
            {contact.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contact.photoUrl}
                alt=""
                className="h-9 w-9 rounded-full border border-stone-200 object-cover"
              />
            ) : secondary ? (
              <UsersThree size={22} weight="duotone" className="text-brand-600" aria-hidden />
            ) : (
              <UserCircle size={22} weight="duotone" className="text-brand-600" aria-hidden />
            )}
            {contact.name}
          </h1>
          {contact.grade && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
              {contact.grade} · every {GRADE_CADENCE[contact.grade]}d
            </span>
          )}
          {/* Spelled out rather than shown as a bare letter: the cadence grade
              sits immediately to the left, and two unlabelled letter grades
              side by side would be unreadable. */}
          {contact.handbookGrade && (
            <span
              title={contact.handbookGradeNote ?? undefined}
              className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700"
            >
              {contact.handbookGrade} · working relationship
            </span>
          )}
          {dueForTouch && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              Due for a touch
            </span>
          )}
          {contact.categories.map((c) => (
            <span key={c} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
              {c}
            </span>
          ))}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-stone-500">
          {contact.company && <span>{contact.company}</span>}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1 hover:text-brand-700"
            >
              <EnvelopeSimple size={14} aria-hidden /> {contact.email}
            </a>
          )}
          {contact.phone && (
            <span className="flex items-center gap-1">
              <Phone size={14} aria-hidden /> {contact.phone}
            </span>
          )}
          {secondary?.email && (
            <span>
              · {secondary.first ?? "Alt"}: {secondary.email}
            </span>
          )}
        </p>
        {social && (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs">
            {(Object.keys(SOCIAL_LABELS) as Array<keyof SocialLinks>).map((k) =>
              social[k] ? (
                <a
                  key={k}
                  href={social[k]}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 hover:underline"
                >
                  {SOCIAL_LABELS[k]}
                </a>
              ) : null,
            )}
          </p>
        )}
      </div>

      {/* Quick actions */}
      <section className={`${card} flex flex-wrap items-end gap-4`}>
        <form action={addContactNote} className="flex min-w-64 flex-1 items-end gap-2">
          <input type="hidden" name="contactId" value={contact.id} />
          <label className={`${labelCls} flex-1`}>
            Quick note
            <input name="body" placeholder="Spoke about listing timing…" className={input} />
          </label>
          <button type="submit" className={btnGhost}>
            Add note
          </button>
        </form>
        <form action={scheduleFollowUp} className="flex items-end gap-2">
          <input type="hidden" name="contactId" value={contact.id} />
          <input type="hidden" name="contactName" value={contact.name} />
          <label className={labelCls}>
            Follow up in
            <select name="when" className={input} defaultValue="1w">
              <option value="3d">3 days</option>
              <option value="1w">1 week</option>
              <option value="2w">2 weeks</option>
              <option value="30d">30 days</option>
              <option value="custom">Custom date…</option>
            </select>
          </label>
          <label className={labelCls}>
            Custom
            <input type="date" name="customDate" className={input} />
          </label>
          <button type="submit" className={btnGhost}>
            Schedule
          </button>
        </form>
        <form action={logTouch}>
          <input type="hidden" name="contactId" value={contact.id} />
          <button type="submit" className={btn} title="Resets the auto-prospecting clock">
            Touched today
          </button>
        </form>
        <Link href={`/dashboard/contacts/${contact.id}/edit`} className={btnGhost}>
          Edit
        </Link>
      </section>

      {/* Tabs */}
      <div>
        {/* Above the tabbed detail, not inside it: these are the things someone
          needs before they act, and a tab is where information goes to be
          missed. */}
        <HandbookNotes
          subjectType="CONTACT"
          subjectId={contact.id}
          notes={handbookNotes}
          canWrite={hb.notes}
          locked={hb.locked}
          hint="What someone new would need telling — how to reach them, what they do and don't cover, anything that has caught the team out before."
        />

        {!hb.locked && canGrade && (
          <SectionCard title="Working relationship">
            <p className="mb-3 text-sm text-stone-500">
              How this business has found dealing with them. Separate from the contact grade above,
              which only sets how often to get in touch.
            </p>
            <HandbookGradeControl
              kind="contact"
              subjectId={contact.id}
              grade={contact.handbookGrade}
              reason={contact.handbookGradeNote}
            />
          </SectionCard>
        )}

        <nav className="flex flex-wrap gap-1 border-b border-stone-200">
          {TABS.map(([key, labelText]) => (
            <Link
              key={key}
              href={`/dashboard/contacts/${contact.id}?tab=${key}`}
              aria-current={tab === key ? "page" : undefined}
              className={`rounded-t-lg px-3 py-2 text-sm transition-colors ${
                tab === key
                  ? "border border-b-0 border-stone-200 bg-white font-medium text-brand-800"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {labelText}
            </Link>
          ))}
        </nav>

        <div className={`${card} rounded-t-none border-t-0`}>
          {tab === "recent" &&
            (recent.length === 0 ? (
              <p className="text-sm text-stone-500">No activity yet — add a note above.</p>
            ) : (
              <ul className="flex flex-col">
                {recent.map((r) => (
                  <li
                    key={r.key}
                    className="flex items-baseline gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                  >
                    <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-stone-400">
                      {fmtDate(r.at)}
                    </span>
                    <span className={r.kind === "note" ? "" : "text-stone-600"}>{r.text}</span>
                  </li>
                ))}
              </ul>
            ))}

          {tab === "transactions" &&
            (transactions.length === 0 ? (
              <p className="text-sm text-stone-500">
                Not on any transactions yet. Add them as a party from a transaction's page.
              </p>
            ) : (
              <div className={tableWrap}>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={th}>Property</th>
                      <th className={th}>Status</th>
                      <th className={th}>Price</th>
                      <th className={th}>Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
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
            ))}

          {tab === "notes" &&
            (contact.contactNotes.length === 0 ? (
              <p className="text-sm text-stone-500">No notes yet.</p>
            ) : (
              <ul className="flex flex-col">
                {contact.contactNotes.map((n) => (
                  <li key={n.id} className="border-b border-stone-100 py-2 text-sm last:border-0">
                    <span className="mr-3 font-mono text-xs tabular-nums text-stone-400">
                      {fmtDate(n.createdAt)}
                    </span>
                    {n.body}
                  </li>
                ))}
              </ul>
            ))}

          {tab === "tasks" &&
            (contact.tasks.length === 0 ? (
              <p className="text-sm text-stone-500">
                No tasks — schedule a follow-up from the bar above.
              </p>
            ) : (
              <ul className="flex flex-col">
                {contact.tasks.map((t) => {
                  const done = t.status === "DONE";
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                    >
                      <form action={toggleTask}>
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          title={done ? "Reopen" : "Mark done"}
                          className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                            done
                              ? "border-brand-600 bg-brand-600 text-white"
                              : "border-stone-300 hover:border-brand-600"
                          }`}
                        >
                          {done ? "✓" : ""}
                        </button>
                      </form>
                      <span className={done ? "text-stone-400 line-through" : ""}>{t.title}</span>
                      <span className="ml-auto tabular-nums text-stone-400">
                        {fmtDate(t.dueDate)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ))}

          {tab === "credentials" && (
            <div className="flex flex-col gap-4">
              {contact.agentOf.length > 0 && (
                <p className="text-sm text-stone-500">
                  Represents{" "}
                  {contact.agentOf.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 && ", "}
                      <Link
                        href={`/dashboard/clients/${a.client.id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {a.client.name}
                      </Link>
                    </span>
                  ))}
                  {contact.portalLinks.some((pl) => !pl.revokedAt)
                    ? " · portal access active"
                    : " · no active portal"}
                </p>
              )}
              {contact.credentials.length === 0 ? (
                <p className="text-sm text-stone-500">
                  No credentials stored for {contact.name} yet — add one below. Encrypted at rest,
                  every reveal audited.
                </p>
              ) : (
                <div className={tableWrap}>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className={th}>System</th>
                        <th className={th}>Username</th>
                        <th className={th}>Secret</th>
                        <th className={th}>URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contact.credentials.map((c) => (
                        <tr key={c.id} className={trHover}>
                          <td className={`${td} font-medium`}>{c.system}</td>
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
              <form
                action={createCredential}
                className="grid gap-3 border-t border-stone-100 pt-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <input type="hidden" name="contactId" value={contact.id} />
                <input type="hidden" name="backTo" value={`/dashboard/contacts/${contact.id}`} />
                <label className={labelCls}>
                  System *
                  <input name="system" required placeholder="MLS — MRED" className={input} />
                </label>
                <label className={labelCls}>
                  Username *
                  <input name="username" required className={input} />
                </label>
                <label className={labelCls}>
                  Password / secret *
                  <input name="secret" type="password" required className={input} />
                </label>
                <label className={labelCls}>
                  Login URL
                  <input name="url" placeholder="https://…" className={input} />
                </label>
                <div className="flex items-end lg:col-start-4">
                  <button type="submit" className={btn}>
                    Save encrypted
                  </button>
                </div>
              </form>
              <p className="text-xs text-stone-400">
                Delete credentials from the{" "}
                <Link href="/dashboard/vault" className="underline hover:text-brand-700">
                  vault
                </Link>
                .
              </p>
            </div>
          )}

          {tab === "touch-dates" && (
            <div className="flex flex-col gap-2 text-sm">
              {(Object.keys(TOUCH_DATE_LABELS) as Array<keyof TouchDates>).map((k) => {
                const v = fmtMonthDay(touchDates[k]);
                return (
                  <p key={k} className="flex gap-3">
                    <span className="w-48 text-stone-500">{TOUCH_DATE_LABELS[k]}</span>
                    <span className={v ? "font-medium" : "text-stone-300"}>{v ?? "—"}</span>
                  </p>
                );
              })}
              <p className="mt-2 text-xs text-stone-400">
                Set these in{" "}
                <Link href={`/dashboard/contacts/${contact.id}/edit`} className="underline">
                  Edit
                </Link>
                .
              </p>
            </div>
          )}

          {tab === "addresses" && (
            <div className="grid gap-6 sm:grid-cols-2">
              <AddressBlock title="Home" a={(contact.homeAddress as Address | null) ?? null} />
              <AddressBlock title="Work" a={(contact.workAddress as Address | null) ?? null} />
              {!contact.homeAddress && !contact.workAddress && (
                <p className="text-sm text-stone-500">No addresses on file.</p>
              )}
            </div>
          )}

          {tab === "details" && (
            <div className="flex flex-col gap-4 text-sm">
              <p className="flex gap-3">
                <span className="w-48 text-stone-500">
                  {ownerNames.length > 1 ? "Owners" : "Owner"}
                </span>
                <span>{ownerNames.length > 0 ? ownerNames.join(", ") : "Unassigned"}</span>
              </p>
              <p className="flex gap-3">
                <span className="w-48 text-stone-500">Referred by</span>
                <span>
                  {contact.referredBy ? (
                    <Link
                      href={`/dashboard/contacts/${contact.referredBy.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {contact.referredBy.name}
                    </Link>
                  ) : (
                    (contact.referralSource ?? "—")
                  )}
                  {contact.referralDate ? ` (${fmtDate(contact.referralDate)})` : ""}
                </span>
              </p>
              <p className="flex gap-3">
                <span className="w-48 text-stone-500">Lead</span>
                <span>
                  {contact.leadType === "BUYER"
                    ? `Potential buyer${lead?.range ? ` · ${lead.range}` : ""}${lead?.location ? ` · ${lead.location}` : ""}`
                    : contact.leadType === "SELLER"
                      ? `Potential seller${lead?.listPrice ? ` · list ${lead.listPrice}` : ""}${lead?.address ? ` · ${lead.address}` : ""}`
                      : "Not a lead"}
                </span>
              </p>
              {lead?.cultivating && (
                <p className="flex gap-3">
                  <span className="w-48 shrink-0 text-stone-500">Cultivating</span>
                  <span className="max-w-prose whitespace-pre-wrap">{lead.cultivating}</span>
                </p>
              )}
              <p className="flex gap-3">
                <span className="w-48 text-stone-500">Last touch</span>
                <span>{fmtDate(contact.touchDate)}</span>
              </p>
              <p className="flex gap-3">
                <span className="w-48 text-stone-500">Next prospecting touch</span>
                <span>{fmtDate(contact.nextTouchAt)}</span>
              </p>
              <p className="flex gap-3 text-xs text-stone-400">
                <span className="w-48">Emails</span>
                <span>
                  Email history lands here once mailbox connections (IMAP/SMTP) ship — it's on the
                  roadmap.
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      <DangerDelete
        action={deleteContact}
        label="Delete this contact"
        description={`Removes ${contact.name}, their notes, and follow-ups. Transaction history is kept. This cannot be undone.`}
        hidden={{ id: contact.id }}
      />
    </div>
  );
}
