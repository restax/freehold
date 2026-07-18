import { Badge } from "@/components/badges";
import { importCsv, readReport } from "@/lib/actions/import";
import { requireTenant } from "@/lib/tenant";
import { btn, card, label } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireTenant();
  const report = await readReport();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Import</h1>
        <p className="text-sm text-stone-500">
          Bring your book of business over from a CSV export. Works with exports from most
          transaction platforms and spreadsheets: Freehold reads the column names, matches what it
          recognizes, and tells you about anything it couldn't read.
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
              No export handy? Download a sample CSV
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
    </div>
  );
}
