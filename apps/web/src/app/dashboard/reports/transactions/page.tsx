import { prisma } from "@freehold/db";
import { ArrowsClockwise, PaperPlaneTilt, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import {
  regenerateReport,
  saveTransactionReportScheduleAction,
  sendTransactionReportNowAction,
} from "@/lib/actions/reports";
import { fmtDayMonth } from "@/lib/format";
import { fmtCents } from "@/lib/pay";
import { requireAdminTenant } from "@/lib/tenant";
import {
  buildTransactionStatusReport,
  readTransactionReportSchedule,
} from "@/lib/transaction-status-report";
import { btn, btnGhost, input, label as labelCls, tableWrap, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const ERROR_MESSAGE: Record<string, string> = {
  invalid: "Enter at least one valid email address.",
  send: "The email didn't go out. Try again in a moment.",
};

export default async function TransactionReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    generated?: string;
    sent?: string;
    error?: string;
    schedule?: string;
  }>;
}) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  const { generated, sent, error, schedule: scheduleMsg } = await searchParams;

  const [data, org] = await Promise.all([
    buildTransactionStatusReport(tenantId),
    prisma.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, emailSettings: true },
    }),
  ]);
  const schedule = readTransactionReportSchedule(org.emailSettings);
  const myEmail = session.user.email ?? "";

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-stone-400">
            <Link href="/dashboard/reports" className="hover:underline">
              Reports
            </Link>{" "}
            / Transaction status
          </p>
          <h1 className="mt-0.5 text-xl font-semibold">{org.name}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {data.fileCount} files across {data.clientCount} clients &middot; generated{" "}
            {data.generatedAt.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <form action={regenerateReport}>
          <button type="submit" className={btnGhost}>
            <ArrowsClockwise size={14} className="mr-1 inline" aria-hidden />
            Recreate
          </button>
        </form>
      </div>

      {generated && (
        <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Recreated just now — every figure below is current.
        </p>
      )}
      {sent && (
        <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Report sent.
        </p>
      )}
      {scheduleMsg === "on" && (
        <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Scheduled delivery saved.
        </p>
      )}
      {scheduleMsg === "off" && (
        <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
          Scheduled delivery turned off.
        </p>
      )}
      {error && ERROR_MESSAGE[error] && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {ERROR_MESSAGE[error]}
        </p>
      )}

      {/* Email now + schedule, side by side */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SectionCard
          title="Email this report"
          icon={<PaperPlaneTilt size={15} weight="fill" aria-hidden />}
          bodyClassName="p-4"
        >
          <form action={sendTransactionReportNowAction} className="flex flex-col gap-2">
            <label className={labelCls}>
              Send to
              <input
                type="text"
                name="recipients"
                defaultValue={myEmail}
                placeholder="name@example.com, another@example.com"
                className={input}
              />
            </label>
            <button type="submit" className={`${btn} self-start`}>
              Send now
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Schedule delivery" bodyClassName="p-4">
          {isAdmin ? (
            <form action={saveTransactionReportScheduleAction} className="flex flex-col gap-2">
              <label className={labelCls}>
                Frequency
                <select
                  name="frequency"
                  defaultValue={schedule?.frequency ?? "off"}
                  className={input}
                >
                  <option value="off">Off</option>
                  <option value="weekly">Weekly, Monday morning</option>
                  <option value="monthly">Monthly, the 1st</option>
                </select>
              </label>
              <label className={labelCls}>
                Recipients
                <input
                  type="text"
                  name="recipients"
                  defaultValue={schedule?.recipients.join(", ") ?? myEmail}
                  placeholder="name@example.com, another@example.com"
                  className={input}
                />
              </label>
              <button type="submit" className={`${btn} self-start`}>
                Save
              </button>
            </form>
          ) : (
            <p className="text-sm text-stone-500">
              Only an owner or admin can change scheduled delivery.
            </p>
          )}
        </SectionCard>
      </div>

      {/* KPI band */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-5">
        {[
          ["Active pipeline", fmtCents(data.activeVolumeCents)],
          ["Closed", fmtCents(data.closedVolumeCents)],
          ["Collected (mo.)", fmtCents(data.collectedThisMonthCents)],
          ["Open tasks", String(data.openTasks)],
          ["Overdue", String(data.overdueTasks)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
              {label}
            </p>
            <p
              className={`mt-1 text-lg font-semibold tabular-nums ${
                label === "Overdue" && data.overdueTasks > 0 ? "text-red-700" : "text-stone-900"
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Attention needed */}
      {data.overdueItems.length > 0 && (
        <SectionCard
          title="Attention needed"
          count={data.overdueItems.length}
          icon={<Warning size={15} weight="fill" className="text-red-600" aria-hidden />}
          className="border-red-300/70"
        >
          <ul className="flex flex-col divide-y divide-stone-100">
            {data.overdueItems.map((o) => (
              <li key={`${o.transactionId}-${o.taskTitle}`} className="py-2">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{o.taskTitle}</span>
                  <Link
                    href={`/dashboard/transactions/${o.transactionId}`}
                    className="text-sm text-stone-500 hover:underline"
                  >
                    {o.address}
                  </Link>
                  <span className="ml-auto text-xs font-semibold uppercase tracking-wide text-red-700">
                    due {fmtDayMonth(o.dueDate)}
                  </span>
                </div>
                {o.notes && <p className="mt-0.5 text-xs text-stone-500">{o.notes}</p>}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Stage sections */}
      {data.stages
        .filter((s) => s.rows.length > 0)
        .map((stage) => (
          <SectionCard
            key={stage.key}
            title={stage.label}
            count={stage.rows.length}
            action={<span className="text-sm text-stone-500">{fmtCents(stage.volumeCents)}</span>}
            bodyClassName="p-0"
          >
            <div className={tableWrap}>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={th}>Address</th>
                    <th className={th}>Client</th>
                    <th className={th}>Price</th>
                    <th className={th}>Close</th>
                    <th className={th}>Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {stage.rows.map((r) => (
                    <tr key={r.id} className={trHover}>
                      <td className={td}>
                        <Link
                          href={`/dashboard/transactions/${r.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {r.address}
                        </Link>
                        {r.city && <span className="ml-1.5 text-stone-400">{r.city}</span>}
                      </td>
                      <td className={td}>{r.clientName ?? "—"}</td>
                      <td className={td}>{fmtCents(r.priceCents)}</td>
                      <td className={td}>{r.closeDate ? fmtDayMonth(r.closeDate) : "—"}</td>
                      <td className={td}>
                        {r.openTasks} open
                        {r.overdueTasks > 0 && (
                          <span className="ml-1.5 font-semibold text-red-700">
                            {r.overdueTasks} overdue
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ))}
    </main>
  );
}
