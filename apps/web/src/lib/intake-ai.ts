/**
 * Whether a contract that arrived through an intake form gets read by AI.
 *
 * Three things have to line up, and the order matters for how it's explained
 * in the UI:
 *
 *   1. The TC turned it on for this client. Never a workspace-wide default —
 *      the upload came from outside, and some clients do not want their
 *      contracts machine-read at all.
 *   2. The plan includes pro AI. This is unmetered work on a file nobody has
 *      opened yet, so unlike a transaction it cannot be unlocked by spending
 *      a single credit — a Free workspace sees the switch explained and
 *      disabled rather than silently doing nothing.
 *   3. There is actually a contract in the submission.
 *
 * Kept pure so the gate is unit-tested rather than inferred from a chain of
 * `&&` inside a conversion transaction.
 */

export type IntakeAiTier = "FREE" | "PAID";

export interface IntakeAiInput {
  /** Client.intakeAiExtraction — the TC's per-client switch. */
  clientEnabled: boolean;
  /** Whether the plan includes pro AI (self-host and paid tiers do). */
  planHasPro: boolean;
  /** How many files the submission carried that could be a contract. */
  contractCount: number;
}

export function intakeAiRuns(input: IntakeAiInput): boolean {
  return input.clientEnabled && input.planHasPro && input.contractCount > 0;
}

/**
 * Why the switch is unavailable, for the client page to say plainly — or
 * null when it can be used. Only the plan can make it unavailable; a client
 * who simply has it off is not "blocked", they're off.
 */
export function intakeAiBlockedReason(planHasPro: boolean): "plan" | null {
  return planHasPro ? null : "plan";
}

/**
 * Which of a submission's files to hand the extractor. Contract extraction
 * reads PDFs, so a phone photo of a lawn sign is skipped rather than sent
 * off to be misread — and only the first one goes, because a submission with
 * five attachments is a review problem, not five contracts.
 */
export function contractCandidates<T extends { contentType: string }>(files: readonly T[]): T[] {
  return files.filter((f) => f.contentType === "application/pdf").slice(0, 1);
}
