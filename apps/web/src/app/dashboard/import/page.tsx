import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { Badge } from "@/components/badges";
import { SaveButton } from "@/components/save-button";
import { SectionCard } from "@/components/section-card";
import { importCsv, readReport } from "@/lib/actions/import";
import { removeSampleData } from "@/lib/actions/sample-data";
import { setDailyBriefing, setInvoiceReport } from "@/lib/actions/templates";
import { emailEnabled } from "@/lib/email";
import { storageStatus } from "@/lib/storage-config";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, btnGhost, card, input, label } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-stone-500">
          Only a workspace admin or owner can bulk-import data. Ask one of them to run this.
        </p>
      </div>
    );
  }
  const report = await readReport();
  const storage = await storageStatus(tenantId);
  const sampleCount = await withTenant(tenantId, async (tx) => {
    const [transactions, contacts] = await Promise.all([
      tx.transaction.count({ where: { isSample: true } }),
      tx.contact.count({ where: { isSample: true } }),
    ]);
    return transactions + contacts;
  });
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { emailSettings: true },
  });
  const briefingOn =
    (org.emailSettings as { dailyBriefing?: boolean } | null)?.dailyBriefing === true;
  const invoiceReportUserId =
    (org.emailSettings as { invoiceReportUserId?: string } | null)?.invoiceReportUserId ?? "";
  const reportMembers = await prisma.member.findMany({
    where: { organizationId: tenantId, role: { not: "guest" } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Import / Export</h1>
        <p className="text-sm text-stone-500">
          Bring your book of business over from a CSV export. Works with exports from most
          transaction platforms and spreadsheets: Freehold reads the column names, matches what it
          recognizes, and tells you about anything it couldn't read. Contacts recognize a full
          CRM-style export too — first/middle/last name, a spouse or partner, home and work
          addresses, multiple phones and emails, birthdays and anniversaries, a relationship grade,
          and dated notes.
        </p>
      </div>

      <section className={card}>
        <form action={importCsv} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-5 text-sm text-stone-700">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="kind"
                value="transactions"
                defaultChecked
                className="accent-brand-600"
              />
              Transactions
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="kind" value="contacts" className="accent-brand-600" />
              Contacts
            </label>
          </div>
          <label className={label}>
            CSV file (max 5 MB)
            <input name="file" type="file" accept=".csv,text/csv" required className="text-sm" />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-stone-700">
            <input type="checkbox" name="dryRun" defaultChecked className="accent-brand-600" />
            Preview only: show me what would be imported without saving anything
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" className={btn}>
              Read the file
            </button>
            <a
              href="/sample-import.csv"
              download
              className="text-sm text-brand-700 hover:text-brand-600"
            >
              No export handy? Download a sample transactions CSV
            </a>
            <a
              href="/sample-import-contacts.csv"
              download
              className="text-sm text-brand-700 hover:text-brand-600"
            >
              Sample contacts CSV
            </a>
          </div>
        </form>
      </section>

      {report && (
        <section className={card}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-medium">
              {report.dryRun ? "Preview" : "Import"} result: {report.kind}
            </h2>
            {report.blocked ? (
              <Badge tone="danger">blocked</Badge>
            ) : report.dryRun ? (
              <Badge tone="progress">nothing saved yet</Badge>
            ) : (
              <Badge tone="success">imported</Badge>
            )}
          </div>

          {report.blocked ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {report.blocked}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1 text-sm text-stone-600">
              <li>
                {report.ready} row{report.ready === 1 ? "" : "s"} readable
                {report.dryRun ? " and ready to import" : ""}
              </li>
              {!report.dryRun && <li>{report.imported} imported</li>}
              <li>
                Columns matched:{" "}
                {report.mapped.length > 0 ? report.mapped.join(", ") : "none recognized"}
              </li>
              {report.unmatched.length > 0 && (
                <li className="text-stone-500">
                  Columns ignored (no matching Freehold field): {report.unmatched.join(", ")}
                </li>
              )}
            </ul>
          )}

          {report.issues.length > 0 && (
            <div className="mt-3 border-t border-stone-100 pt-3">
              <h3 className="text-sm font-medium text-stone-600">Worth a look</h3>
              <ul className="mt-1 flex flex-col gap-0.5 text-sm text-stone-500">
                {report.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {report.dryRun && !report.blocked && report.ready > 0 && (
            <p className="mt-3 text-sm text-stone-500">
              Looks right? Run it again with &quot;Preview only&quot; unchecked to import for real.
            </p>
          )}
        </section>
      )}

      <SectionCard title="Your data">
        <p className="mb-3 text-sm text-stone-500">
          Everything in this workspace — transactions, contacts, clients, tasks, and every document
          — as one ZIP you can take anywhere. Freehold is source-available, so this export plus the{" "}
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

      <h2 className="mt-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Reports</h2>

      {emailEnabled() && (
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

      {emailEnabled() && (
        <SectionCard title="Morning report">
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
            <SaveButton className={btnGhost} />
          </form>
        </SectionCard>
      )}

      <SectionCard title="Sample data">
        {sampleCount > 0 ? (
          <form action={removeSampleData} className="flex items-center gap-3">
            <p className="text-sm text-stone-500">
              This workspace contains sample records (marked "(Sample)").
            </p>
            <button type="submit" className={btnGhost}>
              Remove all sample data
            </button>
          </form>
        ) : (
          <p className="text-sm text-stone-500">No sample data in this workspace.</p>
        )}
      </SectionCard>
    </div>
  );
}
