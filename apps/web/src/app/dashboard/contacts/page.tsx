import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { ColumnPicker } from "@/components/column-picker";
import { EmptyState } from "@/components/empty-state";
import { VoiceSearchBox } from "@/components/voice-search-box";
import { saveContactColumns } from "@/lib/actions/table-prefs";
import {
  CONTACT_COLUMNS,
  contactColumnGroups,
  contactTableMinWidth,
  resolveContactColumns,
} from "@/lib/contact-columns";
import {
  CONTACT_VIEWS,
  contactViewShape,
  hasContactFilters,
  readContactFilters,
  SPHERE_CATEGORY,
  staleBefore,
  upcomingWindow,
} from "@/lib/contact-views";
import { fmtDate } from "@/lib/format";
import { getMemberRole, requireTenant } from "@/lib/tenant";
import { OPEN_STATUSES } from "@/lib/transaction-status";
import { btn, btnGhost, input, tableFixed, tableWrap, tdFixed, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

/** One block in the left filter rail — the panel's repeated shape. */
function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3">
      <p className="mb-2 text-xs font-semibold text-stone-700">{title}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

/**
 * The list query, lifted out so the row type can be inferred from it rather
 * than restated — a column renderer that drifts from the query is a runtime
 * `undefined`, not a compile error.
 */
async function loadContacts(tenantId: string, where: Record<string, unknown>) {
  return withTenant(tenantId, (tx) =>
    tx.contact.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: 500,
      include: {
        owners: { include: { user: { select: { name: true } } } },
        referredBy: { select: { name: true } },
      },
    }),
  );
}

/** The row shape the table renders — inferred from the query above. */
type Row = Awaited<ReturnType<typeof loadContacts>>[number];

const dash = <span className="text-stone-300">—</span>;

function second(c: Row, k: "first" | "last" | "email" | "cell"): string {
  const s = c.secondary as Record<string, string> | null;
  return s?.[k] ?? "";
}

/** Plain text for a cell, used as the hover title so truncation isn't lossy. */
function cellTitle(c: Row, key: string): string {
  switch (key) {
    case "categories":
      return c.categories.join(", ");
    case "owners":
      return c.owners.map((o) => o.user.name).join(", ");
    case "secondName":
      return [second(c, "first"), second(c, "last")].filter(Boolean).join(" ");
    case "secondEmail":
      return second(c, "email");
    case "secondPhone":
      return second(c, "cell");
    default: {
      const v = (c as unknown as Record<string, unknown>)[key];
      return typeof v === "string" ? v : "";
    }
  }
}

function renderCell(c: Row, key: string): React.ReactNode {
  switch (key) {
    case "name":
      return (
        <>
          <Link
            href={`/dashboard/contacts/${c.id}`}
            className="font-medium text-brand-700 hover:text-brand-600"
          >
            {c.name}
          </Link>
          {c.company && <span className="block truncate text-xs text-stone-400">{c.company}</span>}
        </>
      );
    case "categories":
      return c.categories.length === 0 ? (
        dash
      ) : (
        <span className="flex flex-wrap gap-1">
          {c.categories.slice(0, 2).map((cat) => (
            <span
              key={cat}
              className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
            >
              {cat}
            </span>
          ))}
          {c.categories.length > 2 && (
            <span className="text-xs text-stone-400">+{c.categories.length - 2}</span>
          )}
        </span>
      );
    case "owners":
      return c.owners.length === 0 ? dash : c.owners.map((o) => o.user.name).join(", ");
    case "grade":
      return c.grade ? (
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
          {c.grade}
        </span>
      ) : (
        dash
      );
    case "secondName": {
      const n = [second(c, "first"), second(c, "last")].filter(Boolean).join(" ");
      return n || dash;
    }
    case "secondEmail":
      return second(c, "email") || dash;
    case "secondPhone":
      return second(c, "cell") || dash;
    case "lastTouch":
      return c.touchDate ? fmtDate(c.touchDate) : dash;
    case "nextTouch":
      return c.nextTouchAt ? fmtDate(c.nextTouchAt) : dash;
    case "createdAt":
      return fmtDate(c.createdAt);
    case "referredBy":
      return c.referredBy?.name ?? c.referralSource ?? dash;
    default: {
      const v = (c as unknown as Record<string, unknown>)[key];
      return typeof v === "string" && v ? v : dash;
    }
  }
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId, userId } = await requireTenant();
  const params = await searchParams;
  const filters = readContactFilters(params);
  const shape = contactViewShape(filters.view);

  const [org, role, members] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { restrictContactsToOwner: true },
    }),
    getMemberRole(tenantId, userId),
    prisma.member.findMany({
      where: { organizationId: tenantId },
      select: { userId: true, tablePrefs: true, user: { select: { id: true, name: true } } },
    }),
  ]);

  // Admin restriction: members see only their own contacts when enabled.
  const restricted = org.restrictContactsToOwner && role === "member";
  const now = new Date();

  // Owner scope stacks: the workspace restriction and a "mine" view both
  // narrow to this user; an explicit owner filter narrows further.
  const ownerScope =
    restricted || shape.mineOnly
      ? { owners: { some: { userId } } }
      : filters.ownerIds.length > 0
        ? { owners: { some: { userId: { in: filters.ownerIds } } } }
        : {};

  const where = {
    ...ownerScope,
    ...(shape.sphereOnly ? { categories: { has: SPHERE_CATEGORY } } : {}),
    // Never touched at all counts as cold — those are the ones that go missing.
    ...(shape.staleOnly
      ? { OR: [{ touchDate: { lt: staleBefore(now) } }, { touchDate: null }] }
      : {}),
    ...(shape.upcomingTouch ? { nextTouchAt: upcomingWindow(now) } : {}),
    ...(shape.onOpenFile
      ? { parties: { some: { transaction: { status: { in: [...OPEN_STATUSES] } } } } }
      : {}),
    ...(shape.openTasks ? { tasks: { some: { status: { not: "DONE" as const } } } } : {}),
    ...(filters.q
      ? {
          OR: [
            // `name` already merges both people ("Priya & Dev Raman"), so a
            // name search finds the record by either of them. secondarySearch
            // is their lowercased name+email, indexed — people look the second
            // person up constantly, and matching inside the JSON blob meant a
            // case-sensitive scan of every row.
            { name: { contains: filters.q, mode: "insensitive" as const } },
            { company: { contains: filters.q, mode: "insensitive" as const } },
            { email: { contains: filters.q, mode: "insensitive" as const } },
            { secondarySearch: { contains: filters.q.toLowerCase() } },
          ],
        }
      : {}),
    ...(filters.firstName
      ? { firstName: { contains: filters.firstName, mode: "insensitive" as const } }
      : {}),
    ...(filters.lastName
      ? { lastName: { contains: filters.lastName, mode: "insensitive" as const } }
      : {}),
    ...(filters.company
      ? { company: { contains: filters.company, mode: "insensitive" as const } }
      : {}),
    ...(filters.categories.include.length > 0
      ? { categories: { hasSome: filters.categories.include } }
      : {}),
    ...(filters.categories.exclude.length > 0
      ? { NOT: { categories: { hasSome: filters.categories.exclude } } }
      : {}),
    ...(filters.noCategory ? { categories: { isEmpty: true } } : {}),
  };

  const contacts = await loadContacts(tenantId, where);

  // This person's own column layout for this workspace; unset falls back to
  // the defaults in lib/contact-columns.ts.
  const me = members.find((m) => m.userId === userId);
  const storedColumns = (me?.tablePrefs as { contactColumns?: unknown } | null)?.contactColumns;
  const columns = resolveContactColumns(storedColumns);

  const filtersActive = hasContactFilters(filters);
  const linkFor = (view: string) =>
    view === "all" ? "/dashboard/contacts" : `/dashboard/contacts?view=${view}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-xl font-semibold">Contacts</h1>
        <Link href="/dashboard/contacts/new" className={btn}>
          + New contact
        </Link>
      </div>

      {/* Saved views: the questions asked daily, one click each. */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-stone-200">
        {CONTACT_VIEWS.map((v) => {
          const active = v.key === filters.view;
          return (
            <Link
              key={v.key}
              href={linkFor(v.key)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-brand-600 font-medium text-brand-800"
                  : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800"
              }`}
            >
              {v.label}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-stone-500">
          {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
          {filtersActive || filters.view !== "all" ? " matching" : ""}
          {restricted && " · showing only contacts you own (workspace policy)"}
        </p>
        <ColumnPicker
          action={saveContactColumns}
          all={[...CONTACT_COLUMNS]}
          groups={contactColumnGroups()}
          selected={columns.map((c) => c.key)}
        />
      </div>

      {/* Filters on the left, the list on the right — the filters stay put
          while you read, instead of pushing the table down the page. */}
      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <form method="GET" className="flex flex-col gap-2">
          {/* The view survives an Apply; otherwise filtering inside a saved
              view silently throws you back to All. */}
          {filters.view !== "all" && <input type="hidden" name="view" value={filters.view} />}

          <VoiceSearchBox />

          <button type="submit" className={btn}>
            Apply filters
          </button>

          <FilterGroup title="Search term">
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Name, company, email"
              className={input}
            />
            <p className="text-xs text-stone-400">
              Searches names, company and email — including the second person on a record.
            </p>
          </FilterGroup>

          <FilterGroup title="Name">
            <input
              name="firstName"
              defaultValue={filters.firstName ?? ""}
              placeholder="First name"
              className={input}
            />
            <input
              name="lastName"
              defaultValue={filters.lastName ?? ""}
              placeholder="Last name"
              className={input}
            />
          </FilterGroup>

          <FilterGroup title="Company">
            <input
              name="company"
              defaultValue={filters.company ?? ""}
              placeholder="Company"
              className={input}
            />
          </FilterGroup>

          <FilterGroup title="Category">
            <input
              name="category"
              defaultValue={[
                ...filters.categories.include,
                ...filters.categories.exclude.map((c) => `-${c}`),
              ].join(", ")}
              placeholder="category1, category2, …"
              className={input}
            />
            <p className="text-xs text-stone-400">
              Full or partial category names. Prefix with - to exclude, e.g. -Vendor.
            </p>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                name="noCategory"
                value="1"
                defaultChecked={filters.noCategory}
                className="h-4 w-4 accent-brand-600"
              />
              No category
            </label>
            <p className="text-xs text-stone-400">Only contacts with no categories assigned.</p>
          </FilterGroup>

          {!restricted && (
            <FilterGroup title="Contact owner">
              <select
                name="owner"
                multiple
                defaultValue={filters.ownerIds}
                size={Math.min(5, Math.max(2, members.length))}
                className={`${input} h-auto`}
              >
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </FilterGroup>
          )}

          {(filtersActive || filters.view !== "all") && (
            <Link href="/dashboard/contacts" className={`${btnGhost} text-center`}>
              Clear all
            </Link>
          )}
        </form>

        <section>
          {contacts.length === 0 ? (
            <EmptyState
              title="No contacts match"
              hint="Contacts are the people in your world — clients, agents, lenders, inspectors. One record can hold two related people for mailings and merges."
            >
              <Link
                href="/dashboard/contacts/new"
                className="text-sm font-medium text-brand-700 hover:text-brand-600"
              >
                Create a contact →
              </Link>
            </EmptyState>
          ) : (
            <div className={tableWrap}>
              <table className={tableFixed} style={{ minWidth: contactTableMinWidth(columns) }}>
                <colgroup>
                  {columns.map((c) => (
                    <col key={c.key} style={{ width: c.width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th
                        key={c.key}
                        className={`${th} ${c.align === "right" ? "text-right" : ""}`}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id} className={trHover}>
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`${tdFixed} ${col.align === "right" ? "text-right" : ""}`}
                          title={cellTitle(c, col.key)}
                        >
                          {renderCell(c, col.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
