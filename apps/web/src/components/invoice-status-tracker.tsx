import { CheckCircle, FileText, PaperPlaneTilt, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { InvoiceDisplayState } from "@/lib/billing";

type StageStatus = "done" | "active" | "pending";

const STAGES = [
  { key: "draft", label: "Drafted", icon: FileText },
  { key: "issued", label: "Issued", icon: PaperPlaneTilt },
  { key: "paid", label: "Collected", icon: CheckCircle },
] as const;

/**
 * Every invoice walks the same three steps — draft, issue, collect — in that
 * order. Mapping each display state onto per-stage done/active/pending
 * status turns "Unpaid" (a label you have to already know the system to
 * interpret) into a path you can just look at.
 */
const STAGE_MAP: Record<Exclude<InvoiceDisplayState, "void">, StageStatus[]> = {
  draft: ["active", "pending", "pending"],
  unpaid: ["done", "active", "pending"],
  partial: ["done", "done", "active"],
  paid: ["done", "done", "done"],
};

/**
 * A compact draft → issue → collect tracker for one invoice, replacing a
 * single status word with the actual path — same idea as a shipping
 * tracker, just three stops instead of five. Void short-circuits the flow
 * entirely, so it gets its own quiet, non-stepped treatment rather than
 * being forced into a stage that was never reached.
 */
export function InvoiceStatusTracker({
  state,
  className = "",
}: {
  state: InvoiceDisplayState;
  className?: string;
}) {
  if (state === "void") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-400 ${className}`}
      >
        <XCircle size={12} weight="bold" aria-hidden />
        Voided — taken out of the flow
      </div>
    );
  }

  const stages = STAGE_MAP[state];

  return (
    <div
      className={`inline-flex overflow-hidden rounded-full border border-stone-200 ${className}`}
    >
      {STAGES.map((stage, i) => {
        const status = stages[i];
        const Icon = stage.icon;
        const tone =
          status === "active"
            ? "bg-brand-700 text-[var(--color-brand-fg)]"
            : status === "done"
              ? "bg-brand-50 text-brand-700"
              : "bg-stone-50 text-stone-400";
        return (
          <span
            key={stage.key}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${tone} ${
              i > 0 ? "border-l border-stone-200/70" : ""
            }`}
          >
            <Icon size={11} weight={status === "pending" ? "regular" : "bold"} aria-hidden />
            {stage.label}
          </span>
        );
      })}
    </div>
  );
}
