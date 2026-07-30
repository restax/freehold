/**
 * The contract-governed date rule, in one place.
 *
 * `contractDate` and `closeDate` come from a signed contract, so changing one
 * is not a data edit — it's an amendment. The rule:
 *
 * - **null → a date** is first entry, not a change. It applies directly, and
 *   anchored plan tasks get dated off it.
 * - **a date → a different date** does *not* apply. The new value is recorded
 *   as a proposal and an "Amendment needed" task is raised, so the file keeps
 *   saying what the contract says until the paperwork catches up.
 * - **anything else** (unchanged, or cleared) is left alone. Note that
 *   clearing is deliberately a no-op rather than a proposal: a blank field is
 *   far more likely to be a partial form than a request to un-agree a date.
 *
 * Extracted because two paths now edit these dates — the full "Dates &
 * details" form and the inline editor in the Key dates panel — and a rule
 * duplicated in two places is a rule that eventually only holds in one. The
 * failure would be silent: one path proposing an amendment while the other
 * quietly overwrote the contract date.
 *
 * The decision is a pure function so it can be tested without a database;
 * the side effects (the task, the audit line) stay with the callers.
 */

/**
 * The date columns the Key dates panel may edit, and how each is labelled.
 *
 * Lives here rather than beside the server action that uses it: a
 * "use server" module may only export async functions, so a plain constant
 * exported from one is a build error rather than a type error — invisible
 * to tsc and only caught at `next build`.
 */
export const KEY_DATE_LABELS = {
  listDate: "List date",
  onMarketDate: "On market",
  contractDate: "Contract",
  closeDate: "Close",
  mortgageCommitmentDate: "Mortgage commitment",
  inspectionDeadlineDate: "Inspection deadline",
  expireDate: "Expires",
} as const;

export type KeyDateField = keyof typeof KEY_DATE_LABELS;

/**
 * Whether this is a column the Key dates panel may write.
 *
 * `Object.hasOwn`, not `in`: `in` walks the prototype chain, so `"constructor"`
 * and `"__proto__"` both pass it. That matters here because this allowlist is
 * the only thing between a form field named "field" and an arbitrary column
 * name reaching a Prisma update — the check exists precisely to keep untrusted
 * input from choosing what gets written.
 */
export function isKeyDateField(field: string): field is KeyDateField {
  return Object.hasOwn(KEY_DATE_LABELS, field);
}

export const GOVERNED_DATE_FIELDS = ["contractDate", "closeDate"] as const;

export type GovernedDateField = (typeof GOVERNED_DATE_FIELDS)[number];

export type GovernedDateDecision =
  /** Write it. First entry, so there's no contract term to contradict. */
  | { kind: "apply" }
  /** Don't write it. Record the wanted value and raise an amendment. */
  | { kind: "propose"; value: string }
  /** Nothing to do — unchanged, absent, or a clear. */
  | { kind: "noop" };

export function governedDateDecision(
  prev: Date | null | undefined,
  next: Date | null | undefined,
): GovernedDateDecision {
  if (prev && next) {
    return next.getTime() === prev.getTime()
      ? { kind: "noop" }
      : { kind: "propose", value: next.toISOString().slice(0, 10) };
  }
  if (!prev && next) return { kind: "apply" };
  return { kind: "noop" };
}

/** The wording of the amendment task, so both callers raise the same one. */
export function amendmentTitle(field: GovernedDateField, value: string): string {
  return `Amendment needed: ${field === "closeDate" ? "closing date" : "contract date"} → ${value}`;
}

/** Whether this column is contract-governed, narrowing the type on the way. */
export function isGovernedDateField(field: string): field is GovernedDateField {
  return (GOVERNED_DATE_FIELDS as readonly string[]).includes(field);
}
