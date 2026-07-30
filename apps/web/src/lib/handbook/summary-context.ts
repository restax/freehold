/**
 * The facts that go into "Today at a glance", and when a cached one goes off.
 *
 * Split from summary.ts so it can be unit-tested: that file reaches for the
 * Anthropic client and Prisma, and the rule worth testing here — that a note
 * about a person never reaches a briefing written for them — shouldn't need
 * an API key to prove.
 *
 * Relative imports throughout; vitest runs without the Next path aliases.
 */
import { type HandbookNoteLike, summaryNotesFor, type Viewer } from "../handbook";

/** How long a cached briefing stays good. */
export const SUMMARY_MAX_AGE_MS = 60 * 60 * 1000;

export function isStale(writtenAt: Date | null | undefined, now: Date): boolean {
  if (!writtenAt) return true;
  return now.getTime() - writtenAt.getTime() >= SUMMARY_MAX_AGE_MS;
}

export interface SummaryInput {
  /** The reader — decides which notes are even eligible. */
  viewer: Viewer;
  personName: string | null;
  overdue: Array<{ title: string; due: string; property: string | null }>;
  dueToday: Array<{ title: string; property: string | null }>;
  closingSoon: Array<{ property: string; date: string }>;
  /** Staleness/critical-date warnings already computed for the screen. */
  alerts: string[];
  notes: HandbookNoteLike[];
}

const MAX_LINES = 12;

/**
 * The facts handed to the model, as plain text.
 *
 * Built here rather than inline at the call site so the one rule that matters
 * — that a note about a person never reaches a briefing written for them —
 * runs through the tested `summaryNotesFor` on every path, and so the whole
 * prompt can be asserted in a unit test without an API key.
 *
 * Each section is capped. A coordinator with sixty overdue tasks doesn't need
 * all sixty restated at them; they need to know there are sixty.
 */
export function buildSummaryContext(input: SummaryInput, now: Date): string {
  const parts: string[] = [];
  const list = (label: string, items: string[]) => {
    if (items.length === 0) return;
    const shown = items.slice(0, MAX_LINES);
    const extra = items.length - shown.length;
    parts.push(
      `${label}:\n${shown.map((i) => `- ${i}`).join("\n")}${
        extra > 0 ? `\n- (and ${extra} more)` : ""
      }`,
    );
  };

  list(
    "Overdue tasks",
    input.overdue.map((t) => `${t.title}${t.property ? ` (${t.property})` : ""} — due ${t.due}`),
  );
  list(
    "Due today",
    input.dueToday.map((t) => `${t.title}${t.property ? ` (${t.property})` : ""}`),
  );
  list(
    "Closing soon",
    input.closingSoon.map((c) => `${c.property} — ${c.date}`),
  );
  list("Warnings already on screen", input.alerts);

  const notes = summaryNotesFor(input.viewer, input.notes, now);
  list(
    "Notes from the team's handbook",
    notes.map((n) => n.body),
  );

  if (parts.length === 0) return "";
  return parts.join("\n\n");
}
