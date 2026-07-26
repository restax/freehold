import { Warning } from "@phosphor-icons/react/dist/ssr";
import type { TransactionAlert } from "@/lib/alerts";
import { fmtDate } from "@/lib/format";
import { stalenessMessage } from "@/lib/transaction-alerts";

/**
 * The shaded "last touched" block shown inside a transaction: when it was last
 * worked, by whom, and what they did — plus the staleness flag when it's gone
 * quiet. The same three facts appear in the briefing email and PDF; this is
 * the in-app rendering of them.
 */
export function ActivityPanel({ alert }: { alert: TransactionAlert }) {
  const { lastActivity, staleness } = alert;
  const flagged = staleness.stale;
  const tone = flagged ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-stone-50";

  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
          Last touched
        </span>
        {lastActivity ? (
          <>
            <span className="tabular-nums font-medium text-stone-700">
              {fmtDate(lastActivity.at)}
            </span>
            <span className="text-stone-500">
              by <span className="font-medium text-stone-700">{lastActivity.actorName}</span> —{" "}
              {lastActivity.summary}
            </span>
          </>
        ) : (
          <span className="text-stone-500">No activity recorded yet.</span>
        )}
      </div>
      {flagged && (
        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-900">
          <Warning size={13} weight="fill" className="shrink-0 text-amber-600" aria-hidden />
          {stalenessMessage(staleness)}
        </p>
      )}
      {!flagged && staleness.escalatedBy && (
        <p className="mt-1 text-xs text-stone-500">
          {staleness.escalatedBy.label} in {staleness.escalatedBy.daysAway} day
          {staleness.escalatedBy.daysAway === 1 ? "" : "s"} — checked daily until then.
        </p>
      )}
    </div>
  );
}
