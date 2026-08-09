import { Bank, Buildings, Warning } from "@phosphor-icons/react/dist/ssr";
import { SectionCard } from "@/components/section-card";
import { fmtDate } from "@/lib/format";
import {
  hasLoanTerms,
  type LendingTerms,
  LOAN_PURPOSE_LABEL,
  type LoanMetrics,
} from "@/lib/lending";
import { fmtCents } from "@/lib/pay";

/**
 * The loan, on the rail of a lending file.
 *
 * A private lending screen without this is a sale screen with the sale parts
 * deleted. What a lender opens a file to see is the money: how much, at what
 * rate, for how long, and against what the property is worth. Those four sit
 * above everything else here, and the derived figures sit under them.
 *
 * LTV and LTC are both shown because they diverge exactly when the deal is
 * interesting: a buy under market lends at a comfortable share of value while
 * being most of what the borrower is paying. Showing one would flatter or
 * alarm depending which.
 */

function Figure({
  label,
  value,
  hint,
  tone = "plain",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "plain" | "lead" | "warn";
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-stone-400">{label}</dt>
      <dd
        className={
          tone === "lead"
            ? "text-base font-semibold tabular-nums text-stone-900"
            : tone === "warn"
              ? "text-sm font-semibold tabular-nums text-amber-700"
              : "text-sm font-medium tabular-nums text-stone-800"
        }
      >
        {value}
      </dd>
      {hint && <p className="text-[11px] leading-tight text-stone-400">{hint}</p>}
    </div>
  );
}

const dash = "—";

export function LoanCard({
  terms,
  metrics,
  maturity,
  purchasePriceCents,
  editHref,
}: {
  terms: LendingTerms;
  metrics: LoanMetrics;
  maturity: Date | null;
  purchasePriceCents: number | null;
  editHref: string;
}) {
  const rate = terms.ratePct != null ? `${terms.ratePct}%` : dash;
  const term = terms.termMonths != null ? `${terms.termMonths} mo` : dash;

  if (!hasLoanTerms(terms)) {
    return (
      <SectionCard
        title="Loan"
        icon={<Bank size={15} weight="fill" aria-hidden />}
        bodyClassName="p-3"
      >
        <p className="text-sm text-stone-500">
          No terms recorded yet. Add the amount, rate and term from the term sheet and this file
          starts showing its LTV and carry.
        </p>
        <a href={editHref} className="mt-2 inline-block text-xs text-brand-700 hover:underline">
          Add the loan terms →
        </a>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Loan"
      icon={<Bank size={15} weight="fill" aria-hidden />}
      action={
        terms.purpose ? (
          <span className="rounded-full bg-stone-200/70 px-2 py-0.5 text-[11px] font-medium text-stone-600">
            {LOAN_PURPOSE_LABEL[terms.purpose]}
          </span>
        ) : null
      }
      bodyClassName="p-3"
    >
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <Figure
          label="Amount"
          value={terms.loanAmountCents != null ? fmtCents(terms.loanAmountCents) : dash}
          tone="lead"
        />
        <Figure label="Rate / term" value={`${rate} · ${term}`} tone="lead" />
        <Figure
          label="LTV"
          value={metrics.ltvPct != null ? `${metrics.ltvPct}%` : dash}
          hint={
            terms.appraisedValueCents != null
              ? `of ${fmtCents(terms.appraisedValueCents)} appraised`
              : "needs an appraised value"
          }
          // Above 75% is where most private lending books start asking
          // questions, so it is called out rather than left to be read.
          tone={metrics.ltvPct != null && metrics.ltvPct > 75 ? "warn" : "plain"}
        />
        <Figure
          label="LTC"
          value={metrics.ltcPct != null ? `${metrics.ltcPct}%` : dash}
          hint={
            purchasePriceCents != null
              ? `of ${fmtCents(purchasePriceCents)} price`
              : "needs a contract price"
          }
        />
        <Figure
          label="Monthly interest"
          value={
            metrics.monthlyInterestCents != null ? fmtCents(metrics.monthlyInterestCents) : dash
          }
          hint="interest only"
        />
        <Figure
          label="Origination"
          value={metrics.originationFeeCents != null ? fmtCents(metrics.originationFeeCents) : dash}
          hint={terms.points != null ? `${terms.points} pts` : undefined}
        />
        <Figure label="Matures" value={maturity ? fmtDate(maturity) : dash} hint="close + term" />
        <Figure
          label="Cost to borrower"
          value={metrics.totalCostCents != null ? fmtCents(metrics.totalCostCents) : dash}
          hint="if it runs full term"
        />
      </dl>
      <a href={editHref} className="mt-3 inline-block text-xs text-stone-500 hover:text-brand-700">
        Edit loan terms
      </a>
    </SectionCard>
  );
}

/**
 * Who is actually borrowing.
 *
 * Kept apart from the loan because it is a different question, and because
 * three of the thirteen documents underwriting wants exist only to prove what
 * this card asserts: the EIN letter, the articles, and the good-standing
 * certificate. The formation state is here for the same reason, since it
 * decides what that certificate is even called.
 */
export function BorrowerCard({
  terms,
  editHref,
  missingEntity,
}: {
  terms: LendingTerms;
  editHref: string;
  missingEntity: boolean;
}) {
  const rows: Array<[string, string]> = [
    ["Entity", terms.borrower || dash],
    ["Guarantor", terms.guarantor || dash],
    ["Formed in", terms.entityState || dash],
  ];
  return (
    <SectionCard
      title="Borrower"
      icon={<Buildings size={15} weight="fill" aria-hidden />}
      bodyClassName="p-3"
    >
      <dl className="flex flex-col gap-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-stone-500">{k}</dt>
            <dd className="min-w-0 truncate text-right font-medium text-stone-800">{v}</dd>
          </div>
        ))}
      </dl>
      {missingEntity && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-900">
          <Warning size={13} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
          Underwriting wants the EIN letter, the articles and a good-standing certificate for this
          entity. Naming it here says which entity those have to match.
        </p>
      )}
      <a href={editHref} className="mt-3 inline-block text-xs text-stone-500 hover:text-brand-700">
        Edit borrower
      </a>
    </SectionCard>
  );
}
