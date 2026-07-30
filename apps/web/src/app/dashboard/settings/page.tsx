import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { Badge } from "@/components/badges";
import { DangerDelete } from "@/components/danger-delete";
import { SectionCard } from "@/components/section-card";
import { TwoFactorSettings } from "@/components/two-factor-settings";
import {
  createApiKey,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  readNewApiKey,
  revokeApiKey,
} from "@/lib/actions/api-keys";
import { saveBillingDefaults } from "@/lib/actions/billing-policy";
import { setContactVisibilityRestriction } from "@/lib/actions/contacts";
import { saveDirectoryListing } from "@/lib/actions/directory";
import { setHandbookEnabled, setHandbookSummaryEnabled } from "@/lib/actions/handbook";
import { saveHolidaySchedule } from "@/lib/actions/holidays";
import { removeSampleData } from "@/lib/actions/sample-data";
import { addState, removeState, setLicenseEnforcement } from "@/lib/actions/states";
import { setDailyBriefing, setInvoiceReport } from "@/lib/actions/templates";
import { saveSideLabels } from "@/lib/actions/website";
import { BILLING_MODES, tenantBillingPolicy } from "@/lib/billing-policy";
import { enabledHolidayKeys, FEDERAL_HOLIDAYS } from "@/lib/date-calculators";
import {
  AVAILABILITY,
  PRICING_MODELS,
  readDirectoryConfig,
  SOFTWARE,
  SPECIALIZATIONS,
} from "@/lib/directory";
import { emailEnabled } from "@/lib/email";
import { fmtDate } from "@/lib/format";
import { handbookState } from "@/lib/plans";
import { listTenants } from "@/lib/session";
import { tenantSideLabels } from "@/lib/side-labels";
import { storageStatus } from "@/lib/storage-config";
import { getMemberRole, requireTenant } from "@/lib/tenant";
import { btn, btnGhost, input, label, td, th, trHover } from "@/lib/ui";
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
      <SectionCard title="API keys">
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
      </SectionCard>

      <SectionCard title="Webhooks">
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
      </SectionCard>
    </>
  );
}

/**
 * The Handbook's two switches.
 *
 * Worded without "AI memory", "skills" or any of the vocabulary the feature
 * is built from — a coordinator recognises "the things you'd tell someone new",
 * not a retrieval system. See lib/handbook.ts.
 */
async function HandbookSection({ tenantId, userId }: { tenantId: string; userId: string }) {
  const role = await getMemberRole(tenantId, userId);
  if (role !== "owner" && role !== "admin") return null;
  const { prisma } = await import("@freehold/db");
  const [org, state] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { handbookEnabled: true, handbookSummaryEnabled: true },
    }),
    handbookState(tenantId),
  ]);

  if (state.locked) {
    return (
      <SectionCard title="Handbook">
        <p className="mb-3 text-sm text-stone-500">
          Keep what your team knows — a client who wants a call about date changes, a vendor who
          only covers one county, the brokerage that reviews documents before payment — beside the
          work it applies to. Available on a paid plan.
        </p>
        <Link href="/pricing" className={btnGhost}>
          See plans
        </Link>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Handbook">
      <p className="mb-3 text-sm text-stone-500">
        {org.handbookEnabled
          ? "Notes your team keeps about clients, contacts, people and files show up wherever they apply."
          : "The Handbook is off. Existing notes are kept, and come back if you turn it on again."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <form action={setHandbookEnabled}>
          <input type="hidden" name="on" value={org.handbookEnabled ? "0" : "1"} />
          <button type="submit" className={btnGhost}>
            {org.handbookEnabled ? "Turn the Handbook off" : "Turn the Handbook on"}
          </button>
        </form>
        {org.handbookEnabled && (
          <form action={setHandbookSummaryEnabled}>
            <input type="hidden" name="on" value={org.handbookSummaryEnabled ? "0" : "1"} />
            <button
              type="submit"
              className={btnGhost}
              title="The short written recap at the top of Today. Notes and grades keep working either way."
            >
              {org.handbookSummaryEnabled ? "Turn the daily recap off" : "Turn the daily recap on"}
            </button>
          </form>
        )}
      </div>
      {org.handbookEnabled && !org.handbookSummaryEnabled && (
        <p className="mt-2 text-xs text-stone-400">
          Notes and grades are still on — only the written recap on Today is off.
        </p>
      )}
    </SectionCard>
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
    <SectionCard title="Contact visibility">
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
    </SectionCard>
  );
}

async function OperatingStatesSection({ tenantId, userId }: { tenantId: string; userId: string }) {
  const role = await getMemberRole(tenantId, userId);
  if (role !== "owner" && role !== "admin") return null;
  const { prisma } = await import("@freehold/db");
  const [states, org] = await Promise.all([
    withTenant(tenantId, (tx) => tx.tenantState.findMany({ orderBy: { state: "asc" } })),
    prisma.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { licenseEnforcement: true },
    }),
  ]);
  const blocking = org.licenseEnforcement === "block";

  return (
    <SectionCard title="Operating states">
      <p className="mb-3 text-sm text-stone-500">
        The states you work in, and which of them require a licensed coordinator on every file.
        Freehold doesn't decide this for you — mark the ones your business has determined require a
        license. Licences themselves live on each person's{" "}
        <Link href="/dashboard/team" className="text-brand-700 hover:underline">
          team record
        </Link>
        .
      </p>

      {states.length > 0 && (
        <ul className="mb-4 flex flex-col">
          {states.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
            >
              <span className="w-10 font-medium">{s.state}</span>
              <span className={s.licenseRequired ? "text-stone-700" : "text-stone-400"}>
                {s.licenseRequired ? "License required" : "No license requirement"}
              </span>
              <form action={addState} className="ml-auto">
                <input type="hidden" name="state" value={s.state} />
                {!s.licenseRequired && <input type="hidden" name="licenseRequired" value="on" />}
                <button type="submit" className="text-xs text-brand-600 hover:underline">
                  {s.licenseRequired ? "drop requirement" : "require a license"}
                </button>
              </form>
              <form action={removeState}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className="text-xs text-stone-300 hover:text-red-600">
                  remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addState} className="mb-4 flex flex-wrap items-end gap-3">
        <label className={label}>
          State
          <input name="state" required maxLength={2} className={`${input} w-20`} placeholder="TX" />
        </label>
        <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-700">
          <input type="checkbox" name="licenseRequired" className="accent-brand-600" />
          Requires a licensed coordinator
        </label>
        <button type="submit" className={btnGhost}>
          Add state
        </button>
      </form>

      <form action={setLicenseEnforcement} className="border-t border-stone-100 pt-3">
        <p className="mb-2 text-sm font-medium text-stone-700">
          When a file has nobody licensed for its state
        </p>
        <label className="mb-1 flex items-start gap-2 text-sm text-stone-600">
          <input
            type="radio"
            name="licenseEnforcement"
            value="warn"
            defaultChecked={!blocking}
            className="mt-1 accent-brand-600"
          />
          <span>
            <strong className="font-medium text-stone-800">Warn</strong> — the file saves and
            carries a flag until someone licensed is assigned.
          </span>
        </label>
        <label className="mb-3 flex items-start gap-2 text-sm text-stone-600">
          <input
            type="radio"
            name="licenseEnforcement"
            value="block"
            defaultChecked={blocking}
            className="mt-1 accent-brand-600"
          />
          <span>
            <strong className="font-medium text-stone-800">Block</strong> — refuse to save the file
            until someone licensed is assigned.
          </span>
        </label>
        <button type="submit" className={btnGhost}>
          Save enforcement
        </button>
      </form>
    </SectionCard>
  );
}

async function HolidayScheduleSection({ tenantId, userId }: { tenantId: string; userId: string }) {
  const role = await getMemberRole(tenantId, userId);
  if (role !== "owner" && role !== "admin") return null;
  const { prisma } = await import("@freehold/db");
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { holidaySchedule: true },
  });
  const enabled = enabledHolidayKeys(org.holidaySchedule);

  return (
    <SectionCard title="Holiday schedule">
      <p className="mb-3 text-sm text-stone-500">
        Which US federal holidays a key-dates template's business-day math skips. All eleven are on
        by default — uncheck any your workspace doesn't observe.
      </p>
      <form action={saveHolidaySchedule} className="flex flex-col gap-2">
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {FEDERAL_HOLIDAYS.map((h) => (
            <label key={h.key} className="flex items-center gap-1.5 text-sm text-stone-700">
              <input
                type="checkbox"
                name="holiday"
                value={h.key}
                defaultChecked={enabled.has(h.key)}
                className="accent-brand-600"
              />
              {h.label}
            </label>
          ))}
        </div>
        <button type="submit" className={`${btnGhost} self-start`}>
          Save holiday schedule
        </button>
      </form>
    </SectionCard>
  );
}

async function DirectorySection({ tenantId, userId }: { tenantId: string; userId: string }) {
  const role = await getMemberRole(tenantId, userId);
  if (role !== "owner" && role !== "admin") return null;
  const [org, states] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { directoryConfig: true },
    }),
    withTenant(tenantId, (tx) => tx.tenantState.findMany({ orderBy: { state: "asc" } })),
  ]);
  const cfg = readDirectoryConfig(org.directoryConfig);

  return (
    <SectionCard title="Coordinator directory">
      <p className="mb-3 text-sm text-stone-500">
        List this workspace so other coordinators can find you for overflow and vacation coverage.
        Listing publishes your workspace name, the states you cover, and whatever you enter below —
        to other workspaces and to the public directory feed. Nothing about your transactions,
        clients, or people is ever published. Switch it off any time.
      </p>
      {states.length === 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Add the states you work in under <strong>Operating states</strong> above — a listing with
          no coverage won't be found by anyone searching.
        </p>
      )}

      <form action={saveDirectoryListing} className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-stone-800">
          <input
            type="checkbox"
            name="listed"
            defaultChecked={cfg.listed === true}
            className="accent-brand-600"
          />
          List this workspace in the directory
        </label>

        <div className="flex flex-wrap items-end gap-3">
          <label className={`${label} min-w-72 flex-1`}>
            What you want other coordinators to know
            <input
              name="blurb"
              defaultValue={cfg.blurb ?? ""}
              className={input}
              placeholder="Buy-side residential, 48-hour turnaround, Texas and Florida"
            />
          </label>
          <label className={label}>
            Contact email
            <input
              name="contactEmail"
              type="email"
              defaultValue={cfg.contactEmail ?? ""}
              className={input}
            />
          </label>
          <label className={label}>
            Years in business
            <input
              name="yearsExperience"
              inputMode="numeric"
              defaultValue={cfg.yearsExperience ?? ""}
              className={`${input} w-24`}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-6">
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-stone-700">Specializations</legend>
            <div className="flex flex-wrap gap-3">
              {SPECIALIZATIONS.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-sm text-stone-600">
                  <input
                    type="checkbox"
                    name="specializations"
                    value={s}
                    defaultChecked={cfg.specializations?.includes(s)}
                    className="accent-brand-600"
                  />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>
          <label className={label}>
            Availability
            <select name="availability" defaultValue={cfg.availability ?? ""} className={input}>
              <option value="">—</option>
              {AVAILABILITY.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Pricing
            <select name="pricingModel" defaultValue={cfg.pricingModel ?? ""} className={input}>
              <option value="">—</option>
              {PRICING_MODELS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-stone-700">Software you work in</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {SOFTWARE.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm text-stone-600">
                <input
                  type="checkbox"
                  name="software"
                  value={s}
                  defaultChecked={cfg.software?.includes(s)}
                  className="accent-brand-600"
                />
                {s}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            name="remote"
            defaultChecked={cfg.remote !== false}
            className="accent-brand-600"
          />
          Works remotely
        </label>

        <div className="flex items-center gap-3">
          <button type="submit" className={btnGhost}>
            Save listing
          </button>
          <Link href="/dashboard/directory" className="text-sm text-brand-700 hover:underline">
            Browse the directory →
          </Link>
        </div>
      </form>
    </SectionCard>
  );
}

async function AuditSection({ tenantId, userId }: { tenantId: string; userId: string }) {
  const role = await getMemberRole(tenantId, userId);
  if (role !== "owner" && role !== "admin") return null;
  const entries = await withTenant(tenantId, (tx) =>
    tx.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  );
  return (
    <SectionCard title="Audit trail">
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
    </SectionCard>
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
  const storage = await storageStatus(tenantId);
  const role = await getMemberRole(tenantId, session.user.id);
  const isAdmin = role === "owner" || role === "admin";
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { emailSettings: true, billingDefaults: true },
  });
  const billing = tenantBillingPolicy(org.billingDefaults);
  const briefingOn =
    (org.emailSettings as { dailyBriefing?: boolean } | null)?.dailyBriefing === true;
  const invoiceReportUserId =
    (org.emailSettings as { invoiceReportUserId?: string } | null)?.invoiceReportUserId ?? "";
  const reportMembers = isAdmin
    ? await prisma.member.findMany({
        where: { organizationId: tenantId, role: { not: "guest" } },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Settings</h1>

      {/* Independent setting cards sit two-up on wide screens (kept to two so
          each card — including the one with a table — stays comfortably wide). */}
      <div className="columns-1 gap-6 lg:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid">
        <SectionCard title="Workspace">
          <p className="text-sm">
            <span className="text-stone-500">Name:</span> {tenant?.name}
          </p>
          <p className="text-sm">
            <span className="text-stone-500">Signed in as:</span> {session.user.email}
          </p>
        </SectionCard>

        {isAdmin && (
          <SectionCard title="Appearance">
            <p className="mb-3 text-sm text-stone-500">
              Brand the client portal with a colour theme and font, and colour-code task priorities
              and row highlights across your dashboard.
            </p>
            <Link href="/dashboard/settings/appearance" className={btnGhost}>
              Customize appearance
            </Link>
          </SectionCard>
        )}

        <SectionCard title="Your data">
          <p className="mb-3 text-sm text-stone-500">
            Everything in this workspace — transactions, contacts, clients, tasks, and every
            document — as one ZIP you can take anywhere. Freehold is source-available, so this
            export plus the{" "}
            <a
              href="https://github.com/restax/freehold"
              className="text-brand-700 hover:text-brand-600"
            >
              public repo
            </a>{" "}
            is a working copy of your business that never depends on us.
          </p>
          <a href="/api/exports/latest" className={btn} download>
            Download everything
          </a>
          {storage.source === "tenant" ? (
            <p className="mt-3 text-xs text-stone-500">
              Nightly export is <strong>on</strong> — a fresh copy is pushed to your own storage (
              {storage.bucket}) every morning, and the owner gets an email with a link. A backup in
              infrastructure you control.
            </p>
          ) : (
            <p className="mt-3 text-xs text-stone-400">
              Want it automatic?{" "}
              <Link href="/dashboard/integrations" className="text-brand-700 hover:underline">
                Connect your own storage bucket
              </Link>{" "}
              and we'll deliver a nightly export there — a backup in infrastructure you control.
            </p>
          )}
        </SectionCard>

        {isAdmin && (
          <SectionCard title="Client billing defaults">
            <p className="mb-3 text-sm text-stone-500">
              How this workspace bills by default. Any client can override any of this on their
              profile — these are the settings a client gets when you haven't said otherwise.
            </p>
            <form action={saveBillingDefaults} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className={label}>
                  Billing rhythm
                  <select name="mode" defaultValue={billing.mode} className={input}>
                    {BILLING_MODES.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Standard fee ($ per file)
                  <input
                    name="defaultFee"
                    inputMode="decimal"
                    defaultValue={
                      billing.defaultFeeCents == null
                        ? ""
                        : (billing.defaultFeeCents / 100).toFixed(2)
                    }
                    placeholder="350.00"
                    className={`${input} w-32`}
                  />
                </label>
                <label className={label}>
                  Deposit %
                  <input
                    name="depositPercent"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={billing.depositPercent}
                    className={`${input} w-24`}
                  />
                  <span className="text-xs font-normal text-stone-400">
                    for “deposit up front” clients
                  </span>
                </label>
              </div>
              <div className="flex flex-wrap items-end gap-3 rounded-lg bg-stone-50 p-3">
                <label className="flex items-center gap-2 pb-2 text-sm font-medium text-stone-700">
                  <input
                    type="checkbox"
                    name="lateFeeEnabled"
                    value="1"
                    defaultChecked={billing.lateFee.enabled}
                    className="accent-brand-600"
                  />
                  Charge late fees
                </label>
                <label className={label}>
                  Type
                  <select name="lateFeeType" defaultValue={billing.lateFee.type} className={input}>
                    <option value="flat">Flat amount</option>
                    <option value="percent">% of invoice</option>
                  </select>
                </label>
                <label className={label}>
                  Flat ($)
                  <input
                    name="lateFeeFlat"
                    inputMode="decimal"
                    defaultValue={(billing.lateFee.flatCents / 100).toFixed(2)}
                    className={`${input} w-24`}
                  />
                </label>
                <label className={label}>
                  Percent
                  <input
                    name="lateFeePercent"
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    defaultValue={billing.lateFee.percent}
                    className={`${input} w-24`}
                  />
                </label>
                <label className={label}>
                  Grace (days)
                  <input
                    name="lateFeeGrace"
                    type="number"
                    min={0}
                    max={365}
                    defaultValue={billing.lateFee.graceDays}
                    className={`${input} w-24`}
                  />
                </label>
                <p className="w-full text-xs text-stone-400">
                  Late fees are never added silently — an overdue invoice offers a one-click
                  suggested line you approve.
                </p>
              </div>
              <button type="submit" className={`${btnGhost} self-start`}>
                Save billing defaults
              </button>
            </form>
          </SectionCard>
        )}

        {emailEnabled() && isAdmin && (
          <SectionCard title="Daily briefing">
            <p className="mb-3 text-sm text-stone-500">
              Every morning, owners and admins get an emailed summary of every active transaction —
              status, key dates, and the contact details for every party — with a PDF attached. Once
              it's in your inbox it's yours: readable offline, whatever happens to your connection,
              your storage, or us. {briefingOn ? "It's on." : "It's off."}
            </p>
            <form action={setDailyBriefing}>
              <input type="hidden" name="enabled" value={briefingOn ? "0" : "1"} />
              <button type="submit" className={btnGhost}>
                {briefingOn ? "Turn off daily briefing" : "Turn on daily briefing"}
              </button>
            </form>
          </SectionCard>
        )}

        {emailEnabled() && isAdmin && (
          <SectionCard title="Invoice report">
            <p className="mb-3 text-sm text-stone-500">
              Each morning, one chosen person gets the outstanding-invoices list — what's unpaid,
              what's overdue, who to chase. Mornings with nothing outstanding send nothing.{" "}
              {invoiceReportUserId ? "It's on." : "It's off."}
            </p>
            <form action={setInvoiceReport} className="flex flex-wrap items-end gap-3">
              <label className={label}>
                Send to
                <select name="userId" defaultValue={invoiceReportUserId} className={input}>
                  <option value="">— off —</option>
                  {reportMembers.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={btnGhost}>
                Save
              </button>
            </form>
          </SectionCard>
        )}

        <SectionCard title="Two-factor authentication">
          <TwoFactorSettings enabled={Boolean(session.user.twoFactorEnabled)} />
        </SectionCard>

        <OperatingStatesSection tenantId={tenantId} userId={session.user.id} />

        <HolidayScheduleSection tenantId={tenantId} userId={session.user.id} />

        <DirectorySection tenantId={tenantId} userId={session.user.id} />

        <SectionCard title="Side wording">
          <p className="mb-3 text-sm text-stone-500">
            Different markets say it differently — sell side, sale side, list side. Whatever you
            type here is used everywhere sides appear: transactions, portals, and intake forms.
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
        </SectionCard>

        <SectionCard title="Sample data">
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
        </SectionCard>

        <ApiSection tenantId={tenantId} userId={session.user.id} />

        <HandbookSection tenantId={tenantId} userId={session.user.id} />
        <ContactVisibilitySection tenantId={tenantId} userId={session.user.id} />

        <AuditSection tenantId={tenantId} userId={session.user.id} />

        <SectionCard title="System health">
          <p className="text-sm text-stone-500">
            Version 0.0.1 (Stage 01). Include this page in self-host support requests.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
