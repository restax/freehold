/**
 * Private lending files: the underwriting package and what it has to say
 * about money.
 *
 * A private lender's file is a loan, not a sale. The workspace represents the
 * lender; the party at the other end is the borrower; and there is no buy or
 * sell side to be on. If the lender has a processor working in here, what
 * they are doing all day is assembling the documents below and sending them
 * to underwriting.
 *
 * Dependency-free so the rules are unit-tested, same pattern as
 * client-types.ts and compliance.ts.
 */

/** The side a lending file is worked from. There is only ever the one. */
export const LENDING_SIDE = "BORROWER";

export function isLendingSide(side: string | null | undefined): boolean {
  return side === LENDING_SIDE;
}

/** One line of the standard underwriting package. */
export interface LendingDocument {
  name: string;
  /** Shown under the name. Carries the aliases, because these documents are
   *  called different things in different states and by different lenders. */
  description?: string;
  /** Optional lines are tracked but never hold the package back. */
  required: boolean;
  /** An invoice, so the file also records whether it has been settled. */
  paymentTracked?: boolean;
}

/** What a workspace's lending checklist is called when created from here. */
export const LENDING_CHECKLIST_NAME = "Private lending underwriting package";

/**
 * The documents underwriting expects, in the order a processor collects them.
 *
 * Roughly: terms and the borrower first, then the entity, then the collateral
 * and what it is worth, then the closing itself. The HUD is last because it
 * does not exist until the rest is done.
 *
 * Two lines are invoices rather than documents, and the file has to record
 * where they stand — see PAYMENT_LABEL. The insurance one is written to cover
 * either form it arrives in, because a paid-up borrower sends a receipt and
 * everyone else sends a bill.
 */
export const LENDING_DOCUMENTS: LendingDocument[] = [
  {
    name: "Term sheet",
    description: "The agreed terms the rest of the file is underwritten against.",
    required: true,
  },
  {
    name: "Application",
    description: "The borrower's completed loan application.",
    required: true,
  },
  {
    name: "Credit report",
    required: true,
  },
  {
    name: "Bank statements",
    description: "One to three months, depending on what the lender is asking for.",
    required: true,
  },
  {
    name: "EIN letter",
    description: "The IRS letter assigning the borrowing entity its number.",
    required: true,
  },
  {
    name: "Articles of Incorporation",
    description: "Also filed as Articles of Formation or Articles of Organization.",
    required: true,
  },
  {
    name: "Certificate of Good Standing",
    description:
      "Called a Certificate of Existence, Status or Authorization in some states. Whatever the state issues to show the entity is current.",
    required: true,
  },
  {
    name: "Purchase and sale agreement",
    description: "The executed contract on the property being financed.",
    required: true,
  },
  {
    name: "Appraisal",
    required: true,
  },
  {
    name: "Invoice for appraisal",
    description: "Record whether it was paid COD or is coming out of the closing.",
    required: true,
    paymentTracked: true,
  },
  {
    name: "Insurance binder",
    required: true,
  },
  {
    name: "Insurance invoice or receipt",
    description:
      "A receipt if the borrower has paid in full, an invoice if it is being settled at closing. Record which.",
    required: true,
    paymentTracked: true,
  },
  {
    name: "Copy of the HUD",
    description: "The settlement statement, once the closing is figured.",
    required: true,
  },
];

/** Where an invoice on the file stands. */
export type PaymentStatus = "UNPAID" | "PAID_IN_FULL" | "PAID_COD" | "DUE_AT_CLOSING";

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Not paid",
  PAID_IN_FULL: "Paid in full",
  PAID_COD: "Paid COD",
  DUE_AT_CLOSING: "Due at closing",
};

/** The choices offered on a tracked invoice, in the order they're likeliest. */
export const PAYMENT_CHOICES: PaymentStatus[] = [
  "PAID_IN_FULL",
  "PAID_COD",
  "DUE_AT_CLOSING",
  "UNPAID",
];

/** Settled means nothing more is owed. COD counts: it was paid on delivery. */
export function isSettled(status: PaymentStatus | null | undefined): boolean {
  return status === "PAID_IN_FULL" || status === "PAID_COD";
}

/**
 * Whether this invoice still has to reach the settlement statement.
 *
 * An unanswered invoice counts. The whole reason to track payment is to keep
 * a cost off the HUD by accident, and silence is not evidence that something
 * was paid.
 */
export function hitsSettlement(status: PaymentStatus | null | undefined): boolean {
  return !isSettled(status);
}

export interface PaymentSlot {
  name: string;
  paymentTracked: boolean;
  paymentStatus: PaymentStatus | null;
}

export interface PaymentRollup {
  /** Tracked invoices on the file. */
  tracked: number;
  /** Already settled, in full or COD. */
  settled: number;
  /** Names of the invoices that still land on the settlement statement,
   *  including any nobody has answered for yet. */
  atClosing: string[];
  /** Tracked invoices with no answer recorded. A subset of atClosing. */
  unanswered: string[];
}

/**
 * What the file owes at closing, for the line above the underwriting package.
 *
 * Untracked slots are ignored entirely rather than counted as settled — an
 * ordinary document has no payment question, and folding it in would make the
 * denominator meaningless.
 */
export function paymentRollup(slots: PaymentSlot[]): PaymentRollup {
  const tracked = slots.filter((s) => s.paymentTracked);
  return {
    tracked: tracked.length,
    settled: tracked.filter((s) => isSettled(s.paymentStatus)).length,
    atClosing: tracked.filter((s) => hitsSettlement(s.paymentStatus)).map((s) => s.name),
    unanswered: tracked.filter((s) => s.paymentStatus == null).map((s) => s.name),
  };
}

/**
 * The wording a lending file uses where a sale file says "compliance".
 *
 * A processor is not passing a broker's compliance review, they are sending a
 * package to underwriting. Same mechanism underneath — collect, submit,
 * approve or send back — so this is a label map rather than a second flow.
 */
export interface PackageWording {
  tab: string;
  title: string;
  submit: string;
  submitted: string;
  intro: string;
  startRound: string;
  /** The side-rail line before anything has been started. Spelled out rather
   *  than derived from `title`, which would drop the word "round". */
  noRound: string;
}

export const SALE_WORDING: PackageWording = {
  tab: "Compliance",
  title: "Compliance",
  submit: "Submit for review",
  submitted: "Submitted",
  intro:
    "Attach a file to each required document, then submit the whole file for review. A reviewer approves each one or sends it back with a note.",
  startRound: "Start compliance round",
  noRound: "No compliance round started yet.",
};

export const LENDING_WORDING: PackageWording = {
  tab: "Underwriting",
  title: "Underwriting package",
  submit: "Send to underwriting",
  submitted: "Sent to underwriting",
  intro:
    "Attach a file to each document underwriting expects, record where the invoices stand, then send the package up. An underwriter clears each document or sends it back with a note.",
  startRound: "Start the underwriting package",
  noRound: "No underwriting package started yet.",
};

export function packageWording(side: string | null | undefined): PackageWording {
  return isLendingSide(side) ? LENDING_WORDING : SALE_WORDING;
}

/**
 * The side a file is actually on, which is not a free choice.
 *
 * A private lender's files are loans and everyone else's are sales, so the
 * side follows from the client rather than from whatever the form posted. Two
 * directions to enforce, and the second is the one that matters: a hand-posted
 * BORROWER on an ordinary client would put a sale file on a layout with no
 * buy or sell side and no sale checklist to match it.
 *
 * Falls back to sale sides whenever private lending is switched off, so a
 * workspace that changes its mind doesn't strand files on a side it no longer
 * offers — the same reasoning as transactionLayout in client-types.ts.
 */
export function enforcedSide(opts: {
  requested: string;
  clientType: string | null | undefined;
  privateLendingEnabled: boolean;
  /** Where to land a sale file that asked for BORROWER. */
  fallback?: string;
}): string {
  const { requested, clientType, privateLendingEnabled, fallback = "BUY_SIDE" } = opts;
  if (privateLendingEnabled && clientType === "PRIVATE_LENDER") return LENDING_SIDE;
  return requested === LENDING_SIDE ? fallback : requested;
}

// --- The loan itself ---------------------------------------------------

/** Why the money is being lent. Drives nothing yet; it is the first thing a
 *  lender says about a file, so the screen leads with it. */
export type LoanPurpose = "PURCHASE" | "REFINANCE" | "BRIDGE" | "CONSTRUCTION";

export const LOAN_PURPOSE_LABEL: Record<LoanPurpose, string> = {
  PURCHASE: "Purchase",
  REFINANCE: "Refinance",
  BRIDGE: "Bridge",
  CONSTRUCTION: "Construction",
};

const PURPOSES: LoanPurpose[] = ["PURCHASE", "REFINANCE", "BRIDGE", "CONSTRUCTION"];

/**
 * The loan on a lending file.
 *
 * Every field is optional. A file is opened at the term-sheet stage and
 * filled in as the package comes together, so a half-empty loan is the normal
 * state for most of its life, not an error to guard against.
 */
export interface LendingTerms {
  purpose: LoanPurpose | null;
  loanAmountCents: number | null;
  /** Annual rate as a percentage: 11.5 means 11.5%. */
  ratePct: number | null;
  termMonths: number | null;
  /** Origination points, as a percentage of the loan. */
  points: number | null;
  /** What the appraisal came back at, which is what LTV is measured against. */
  appraisedValueCents: number | null;
  /** The borrowing entity. Hence the EIN letter and the articles. */
  borrower: string;
  /** The person standing behind the entity. */
  guarantor: string;
  /** Where the entity was formed, which decides what its good-standing
   *  certificate is even called. */
  entityState: string;
}

export const EMPTY_LENDING_TERMS: LendingTerms = {
  purpose: null,
  loanAmountCents: null,
  ratePct: null,
  termMonths: null,
  points: null,
  appraisedValueCents: null,
  borrower: "",
  guarantor: "",
  entityState: "",
};

/** A non-negative finite number, or null. Rejects NaN, Infinity and strings
 *  that only look numeric, so a hand-edited column can't produce an LTV of
 *  Infinity on the screen. */
function num(v: unknown, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max) return null;
  return v;
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, 200) : "";
}

/**
 * Read the lendingTerms column, treating it as hostile.
 *
 * Same posture as the address-search parser: remote or hand-edited JSON turns
 * into empty terms, never a 500 and never a nonsense figure on screen.
 */
export function parseLendingTerms(raw: unknown): LendingTerms {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY_LENDING_TERMS };
  const r = raw as Record<string, unknown>;
  const purpose = PURPOSES.includes(r.purpose as LoanPurpose) ? (r.purpose as LoanPurpose) : null;
  return {
    purpose,
    // A trillion-dollar cap and a 100% rate cap are not validation so much as
    // a backstop against a stray keystroke rendering an absurd figure.
    loanAmountCents: num(r.loanAmountCents, 1e14),
    ratePct: num(r.ratePct, 100),
    termMonths: num(r.termMonths, 600),
    points: num(r.points, 100),
    appraisedValueCents: num(r.appraisedValueCents, 1e14),
    borrower: text(r.borrower),
    guarantor: text(r.guarantor),
    entityState: text(r.entityState).toUpperCase().slice(0, 2),
  };
}

/** True once there is anything worth showing in the loan panel. */
export function hasLoanTerms(t: LendingTerms): boolean {
  return (
    t.purpose != null ||
    t.loanAmountCents != null ||
    t.ratePct != null ||
    t.termMonths != null ||
    t.points != null ||
    t.appraisedValueCents != null ||
    t.borrower !== "" ||
    t.guarantor !== "" ||
    t.entityState !== ""
  );
}

export interface LoanMetrics {
  /** Loan against what the appraisal says the property is worth. The number a
   *  private lender is actually underwriting to. */
  ltvPct: number | null;
  /** Loan against what the borrower is paying for it. Diverges from LTV when
   *  the buy is under market, which is the whole thesis of most of these
   *  deals, so both are worth showing. */
  ltcPct: number | null;
  /** Interest-only, which is what these loans almost always are. */
  monthlyInterestCents: number | null;
  originationFeeCents: number | null;
  /** Interest over the full term if it runs to maturity, plus origination. */
  totalCostCents: number | null;
}

/**
 * The figures a lender reads off a file, derived rather than typed.
 *
 * Nothing is guessed: a metric whose inputs are missing comes back null and
 * the panel shows a dash. Dividing by a zero appraisal returns null rather
 * than Infinity.
 */
export function loanMetrics(
  t: LendingTerms,
  purchasePriceCents: number | null | undefined,
): LoanMetrics {
  const amount = t.loanAmountCents;
  const pct = (part: number | null, whole: number | null | undefined) =>
    part != null && whole != null && whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

  const monthlyInterestCents =
    amount != null && t.ratePct != null ? Math.round((amount * (t.ratePct / 100)) / 12) : null;
  const originationFeeCents =
    amount != null && t.points != null ? Math.round(amount * (t.points / 100)) : null;

  return {
    ltvPct: pct(amount, t.appraisedValueCents),
    ltcPct: pct(amount, purchasePriceCents),
    monthlyInterestCents,
    originationFeeCents,
    totalCostCents:
      monthlyInterestCents != null && t.termMonths != null
        ? monthlyInterestCents * t.termMonths + (originationFeeCents ?? 0)
        : null,
  };
}

/**
 * When the loan comes due, from the closing date and the term.
 *
 * Clamped to the last day of the target month, so a twelve-month loan closing
 * on the 31st matures on the 28th rather than silently rolling into March.
 */
export function maturityDate(
  closeDate: Date | null | undefined,
  termMonths: number | null,
): Date | null {
  if (!closeDate || termMonths == null || termMonths <= 0) return null;
  const y = closeDate.getUTCFullYear();
  const m = closeDate.getUTCMonth() + termMonths;
  const day = closeDate.getUTCDate();
  const lastOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, lastOfTarget)));
}
