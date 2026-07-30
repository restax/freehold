import { Warning } from "@phosphor-icons/react/dist/ssr";
import type { ActivityEntry } from "@/lib/activity";
import type { TransactionAlert } from "@/lib/alerts";
import { stalenessMessage } from "@/lib/transaction-alerts";

/** "Jul 30, 2:14 PM" — date and time together, since a recap of what happened
 *  today needs the hour, not just the day. */
function fmtDateTime(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The shaded recap block shown inside a transaction: the last few things that
 * happened, when, and who did them — plus the staleness flag when the file
 * has gone quiet. The staleness verdict still reads off the single most
 * recent touch (see lib/transaction-alerts); the list below is purely for a
 * coordinator asking "what actually happened here".
 */
export function ActivityPanel({
  alert,
  recent,
}: {
  alert: TransactionAlert;
  /** Newest first; empty renders the "no activity" fallback. */
  recent: ActivityEntry[];
}) {
  const { staleness, urgentTasks } = alert;
  const flagged = staleness.stale;
  const mostUrgent = urgentTasks[0] ?? null;
  const critical = mostUrgent != null && mostUrgent.businessDaysAway <= 1;
  const tone = critical
    ? "border-red-300 bg-red-50"
    : flagged || mostUrgent
      ? "border-amber-300 bg-amber-50"
      : "border-stone-200 bg-stone-50";

  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      {mostUrgent && (
        <p
          className={`mb-1.5 flex items-center gap-1.5 border-b pb-1.5 text-xs font-semibold ${
            critical ? "border-red-200 text-red-800" : "border-amber-200/70 text-amber-900"
          }`}
        >
          <Warning
            size={13}
            weight="fill"
            className={`shrink-0 ${critical ? "text-red-600" : "text-amber-600"}`}
            aria-hidden
          />
          "{mostUrgent.title}" is still open,{" "}
          {mostUrgent.calendarDaysAway === 0
            ? "due today"
            : `due in ${mostUrgent.calendarDaysAway}d`}{" "}
          — only {mostUrgent.businessDaysAway} business day
          {mostUrgent.businessDaysAway === 1 ? "" : "s"} left to act.
        </p>
      )}
      <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
        Recent activity
      </span>
      {recent.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-0.5">
          {recent.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="shrink-0 tabular-nums text-xs text-stone-400">
                {fmtDateTime(a.at)}
              </span>
              <span className="text-stone-600">
                <span className="font-medium text-stone-700">{a.actorName}</span> — {a.summary}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-stone-500">No activity recorded yet.</p>
      )}
      {flagged && (
        <p className="mt-1.5 flex items-center gap-1.5 border-t border-amber-200/70 pt-1.5 text-xs font-medium text-amber-900">
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
