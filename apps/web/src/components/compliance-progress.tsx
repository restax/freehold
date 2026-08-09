import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ComplianceProgress } from "@/lib/compliance";

/**
 * Where a file stands on compliance, on every tab rather than only inside the
 * Compliance one.
 *
 * The question "can this close" shouldn't require remembering to go and look.
 * A bar plus a count is enough to answer it at a glance and click through when
 * the answer is no.
 */
export function ComplianceProgressCard({
  transactionId,
  state,
  progress,
}: {
  transactionId: string;
  /** Why there's nothing to show, when there isn't. */
  state: "on" | "off" | "no-round" | "no-client";
  progress: ComplianceProgress | null;
}) {
  const href = `/dashboard/transactions/${transactionId}?tab=compliance`;

  if (state !== "on" || !progress) {
    const copy =
      state === "off"
        ? "Compliance is off for this client. Nothing is required to close."
        : state === "no-client"
          ? "No client on this file, so no compliance rules apply."
          : "No compliance round started yet.";
    return (
      <div className="rounded-lg border border-stone-200/70 bg-white p-3">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
          <ShieldCheck size={13} weight="fill" aria-hidden />
          Compliance
        </p>
        <p className="mt-1 text-sm text-stone-500">{copy}</p>
        {state === "no-round" && (
          <Link href={href} className="mt-1 inline-block text-xs text-brand-700 hover:underline">
            Open compliance
          </Link>
        )}
      </div>
    );
  }

  const clear = progress.remaining === 0;
  return (
    <Link
      href={href}
      className="block rounded-lg border border-stone-200/70 bg-white p-3 transition-colors hover:border-brand-300"
    >
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
        <ShieldCheck size={13} weight="fill" aria-hidden />
        Compliance
      </p>
      <p className={`mt-1 text-sm font-medium ${clear ? "text-emerald-700" : "text-stone-800"}`}>
        {clear
          ? `All ${progress.total} required document${progress.total === 1 ? "" : "s"} approved`
          : `${progress.remaining} of ${progress.total} required document${
              progress.total === 1 ? "" : "s"
            } remaining`}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full ${clear ? "bg-emerald-600" : "bg-brand-600/80"}`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {progress.returned > 0 && (
        <p className="mt-1.5 text-xs font-medium text-red-700">
          {progress.returned} sent back for changes
        </p>
      )}
    </Link>
  );
}
