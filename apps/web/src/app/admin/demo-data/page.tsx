import { ArrowsClockwise, Database } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { loadDemoData, redateDemoData, wipeDemoData } from "@/lib/actions/demo-data";
import {
  DEMO_CLIENTS,
  DEMO_CONTACTS,
  DEMO_TEAMMATES,
  DEMO_TRANSACTIONS,
  overdueDemoTasks,
  upcomingDemoTasks,
} from "@/lib/demo-dataset/data";
import { DEMO_WORKSPACE_SLUG, demoWorkspaceStatus } from "@/lib/demo-workspace";
import { fmtDate } from "@/lib/format";
import { isOperator } from "@/lib/operator";
import { btn, btnDanger, btnGhost, tableWrap, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const DONE_MESSAGE: Record<string, string> = {
  loaded: "Demo data loaded. Every date is set relative to today.",
  redated: "Dates shifted to today.",
  wiped: "Demo data removed.",
};

const ERROR_MESSAGE: Record<string, string> = {
  noworkspace: `No workspace with the slug "${DEMO_WORKSPACE_SLUG}" exists on this deployment.`,
  seed: "Loading failed partway through. The data may be incomplete, so wipe and try again.",
  redate: "Re-dating failed. Nothing was changed.",
  wipe: "The wipe failed partway through. Try again.",
};

/**
 * Operator controls for the recorded-demo dataset. Loads a full fictional
 * practice into one real workspace so training videos have something to show,
 * and re-dates it later so a recording made in two months still shows
 * deadlines as upcoming.
 */
export default async function AdminDemoDataPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string; days?: string }>;
}) {
  if (!(await isOperator())) notFound();
  const { done, error, days } = await searchParams;
  const status = await demoWorkspaceStatus();

  const seeded = Boolean(status?.seededAt);
  const overdue = overdueDemoTasks().length;
  const upcoming = upcomingDemoTasks(30).length;
  const closed = DEMO_TRANSACTIONS.filter((t) => t.invoice).length;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Demo data</h1>
          <p className="mt-1 text-sm text-stone-500">
            A full fictional practice for recording training videos, loaded into{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">
              {status?.orgName ?? DEMO_WORKSPACE_SLUG}
            </code>
            .
          </p>
        </div>
        <Link href="/admin" className={btnGhost}>
          Back to admin
        </Link>
      </div>

      {done && DONE_MESSAGE[done] ? (
        <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {DONE_MESSAGE[done]}
          {done === "redated" && days ? ` Moved everything forward by ${days} days.` : null}
          {done === "redated" && days === "0"
            ? " Nothing to do, the data was already dated today."
            : null}
        </p>
      ) : null}
      {error && ERROR_MESSAGE[error] ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {ERROR_MESSAGE[error]}
        </p>
      ) : null}

      <SectionCard
        title="Current state"
        icon={<Database size={15} weight="fill" aria-hidden />}
        bodyClassName="p-4"
      >
        {status ? (
          <>
            <p className="text-sm text-stone-600">
              {seeded ? (
                <>
                  Last loaded <strong>{fmtDate(status.seededAt)}</strong>. All dates are relative to
                  that day.
                </>
              ) : (
                <>Not loaded yet. Nothing from the demo set is in this workspace.</>
              )}
            </p>
            <div className={`mt-3 ${tableWrap}`}>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {[
                      "Clients",
                      "Contacts",
                      "Files",
                      "Tasks",
                      "Documents",
                      "Email",
                      "Invoices",
                    ].map((h) => (
                      <th key={h} className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className={trHover}>
                    <td className={td}>{status.counts.clients}</td>
                    <td className={td}>{status.counts.contacts}</td>
                    <td className={td}>{status.counts.transactions}</td>
                    <td className={td}>{status.counts.tasks}</td>
                    <td className={td}>{status.counts.documents}</td>
                    <td className={td}>{status.counts.emails}</td>
                    <td className={td}>{status.counts.invoices}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-red-700">
            No workspace with the slug <code>{DEMO_WORKSPACE_SLUG}</code> exists here, so there is
            nowhere to load the data.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="What gets loaded"
        icon={<Database size={15} weight="fill" aria-hidden />}
        bodyClassName="p-4"
      >
        <ul className="flex flex-col gap-1.5 text-sm text-stone-600">
          <li>
            <strong>{DEMO_TRANSACTIONS.length} transactions</strong> across {closed} closed and
            billed, 3 live listings, and the rest mid-flight.
          </li>
          <li>
            <strong>{DEMO_CLIENTS.length} clients</strong>, three of which own every file, and{" "}
            <strong>{DEMO_CONTACTS.length} contacts</strong> covering buyers, sellers, agents,
            lenders, title, and inspection.
          </li>
          <li>
            <strong>{DEMO_TEAMMATES.length} extra coordinators</strong> (
            {DEMO_TEAMMATES.map((m) => m.name).join(" and ")}) added to the workspace, with work
            assigned to them so the file history has more than one name on it.
          </li>
          <li>
            <strong>{upcoming} tasks due in the next 30 days</strong> and exactly{" "}
            <strong>{overdue} overdue</strong>, both carrying notes explaining the holdup.
          </li>
          <li>
            A generated <strong>MLS listing sheet for every file</strong> and a{" "}
            <strong>purchase agreement</strong> for each one under contract, as real PDFs in four
            different form styles.
          </li>
          <li>Inbound and sent email on the active files, plus notes on clients and contacts.</li>
        </ul>
        <p className="mt-3 text-xs text-stone-500">
          Everything is flagged as sample data so it can be removed cleanly, but nothing is labelled
          "(Sample)" on screen and the usual remove-your-sample-data banner stays hidden, so
          recordings look like a real workspace.
        </p>
      </SectionCard>

      <SectionCard
        title="Actions"
        icon={<ArrowsClockwise size={15} weight="fill" aria-hidden />}
        bodyClassName="p-4 flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <form action={loadDemoData}>
            <button type="submit" className={btn} disabled={!status}>
              {seeded ? "Reload from scratch" : "Load demo data"}
            </button>
          </form>
          <p className="text-xs text-stone-500">
            Wipes whatever is there and rebuilds it against today's date. Use this to get back to a
            known-good starting point before recording. Takes up to a minute.
          </p>
        </div>

        <div className="flex flex-col gap-1 border-t border-stone-100 pt-4">
          <form action={redateDemoData}>
            <button type="submit" className={btnGhost} disabled={!seeded}>
              Re-date to today
            </button>
          </form>
          <p className="text-xs text-stone-500">
            Shifts every date forward by however long it has been since the last load, so deadlines
            are upcoming again. Keeps anything you changed during past demos. This is the one to use
            if you come back in two months and just want the dates to make sense.
          </p>
        </div>

        <div className="flex flex-col gap-1 border-t border-stone-100 pt-4">
          <form action={wipeDemoData}>
            <button type="submit" className={btnDanger} disabled={!status}>
              Remove all demo data
            </button>
          </form>
          <p className="text-xs text-stone-500">
            Deletes every demo row from the workspace and leaves it empty.
          </p>
        </div>
      </SectionCard>
    </main>
  );
}
