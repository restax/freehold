import { STATUS_LABEL } from "@/lib/format";

/**
 * Square-cornered badges with a colored dot — one quiet surface, semantic
 * color carried by the dot only (no rainbow pills).
 */

export type BadgeTone = "success" | "progress" | "attention" | "danger" | "neutral";

const DOT: Record<BadgeTone, string> = {
  success: "bg-brand-600",
  progress: "bg-amber-500",
  attention: "bg-violet-500",
  danger: "bg-red-500",
  neutral: "bg-stone-400",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}

const TXN_TONE: Record<string, BadgeTone> = {
  LISTING: "attention",
  UNDER_CONTRACT: "progress",
  PENDING: "progress",
  CLOSED: "success",
  CANCELLED: "neutral",
};

/** Dot color for a transaction status, for use outside a badge (e.g. stat strip). */
export function statusDot(status: string): string {
  return DOT[TXN_TONE[status] ?? "neutral"];
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={TXN_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

const ENVELOPE_TONE: Record<string, BadgeTone> = {
  COMPLETED: "success",
  SENT: "progress",
  DECLINED: "danger",
  ERROR: "danger",
};

export function EnvelopeBadge({ status }: { status: string }) {
  return <Badge tone={ENVELOPE_TONE[status] ?? "neutral"}>{status.toLowerCase()}</Badge>;
}

const EXTRACTION_TONE: Record<string, BadgeTone> = {
  READY: "progress",
  APPLIED: "success",
  FAILED: "danger",
};

export function ExtractionBadge({ status }: { status: string }) {
  return (
    <Badge tone={EXTRACTION_TONE[status] ?? "neutral"}>
      {status === "READY" ? "Needs review" : status.toLowerCase()}
    </Badge>
  );
}
