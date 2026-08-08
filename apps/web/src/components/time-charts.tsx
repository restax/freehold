import Link from "next/link";
import { AddressPill } from "@/components/address-pill";
import { type ClientTime, type FileTimeRow, fmtMinutes } from "@/lib/time-tracking";

/**
 * The "time on files" panels: what a file costs against what it bills, which
 * clients absorb the most hours, and which are the most efficient per file.
 * Same idiom as dashboard-charts.tsx — plain divs, numbers a hover away,
 * no charting library.
 */

const fmtUsd = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

/** Files ranked by time, each against its expected fee and effective hourly. */
export function TimeVsFeeChart({ files }: { files: FileTimeRow[] }) {
  if (files.length === 0) {
    return (
      <p className="text-sm text-stone-400">
        No time recorded yet. Minutes accrue automatically while a transaction page is open — open a
        file and this fills in on its own.
      </p>
    );
  }
  const max = Math.max(...files.map((f) => f.minutes));

  return (
    <ul className="flex flex-col gap-2.5">
      {files.map((f) => (
        <li key={f.transactionId}>
          <div className="flex items-baseline justify-between gap-2">
            <AddressPill
              href={`/dashboard/transactions/${f.transactionId}`}
              className="min-w-0 text-xs"
            >
              {f.propertyAddress}
            </AddressPill>
            <span className="shrink-0 text-xs tabular-nums text-stone-500">
              {fmtMinutes(f.minutes)}
              {f.expectedFeeCents ? ` · ${fmtUsd(f.expectedFeeCents)} fee` : ""}
              {f.hourlyCents ? (
                <span className="font-medium text-stone-700"> · {fmtUsd(f.hourlyCents)}/hr</span>
              ) : null}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-brand-600/80"
              style={{ width: `${Math.round((f.minutes / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Clients ranked by total minutes across every user — where the hours go. */
export function TimeByClientChart({ clients }: { clients: ClientTime[] }) {
  if (clients.length === 0) {
    return <p className="text-sm text-stone-400">No client time recorded in this window yet.</p>;
  }
  const max = Math.max(...clients.map((c) => c.minutes));

  return (
    <ul className="flex flex-col gap-2">
      {clients.map((c) => (
        <li key={c.clientId}>
          <div className="flex items-baseline justify-between gap-2">
            <Link
              href={`/dashboard/clients/${c.clientId}`}
              className="min-w-0 truncate text-sm text-brand-700 hover:underline"
            >
              {c.clientName}
            </Link>
            <span className="shrink-0 text-xs tabular-nums text-stone-500">
              {fmtMinutes(c.minutes)} · {c.files} file{c.files === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-brand-600/80"
              style={{ width: `${Math.round((c.minutes / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Clients ranked by least average time per file — the most profitable work. */
export function EfficientClientsChart({ clients }: { clients: ClientTime[] }) {
  if (clients.length === 0) {
    return <p className="text-sm text-stone-400">No client time recorded in this window yet.</p>;
  }
  const max = Math.max(...clients.map((c) => c.avgMinutesPerFile));

  return (
    <ul className="flex flex-col gap-2">
      {clients.map((c) => (
        <li key={c.clientId}>
          <div className="flex items-baseline justify-between gap-2">
            <Link
              href={`/dashboard/clients/${c.clientId}`}
              className="min-w-0 truncate text-sm text-brand-700 hover:underline"
            >
              {c.clientName}
            </Link>
            <span className="shrink-0 text-xs tabular-nums text-stone-500">
              {fmtMinutes(c.avgMinutesPerFile)}/file
            </span>
          </div>
          {/* Shorter bar = better here, so the bar reads as "time consumed"
              in the same visual language as the panel above it. */}
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-brand-600/80"
              style={{ width: `${Math.max(4, Math.round((c.avgMinutesPerFile / max) * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
