/**
 * House style for the Handbook's "Today at a glance" summary.
 *
 * A source file, not a database seed, so a self-hosted install always has a
 * usable default with nothing to provision. An operator can override it from
 * /admin (PlatformSetting.handbookStyleGuide); this is what they start from
 * and what they get back by clearing the field.
 *
 * It is written at the model rather than at the reader, and it is mostly a
 * list of refusals. The failure mode for a daily summary isn't being wrong —
 * it can only restate facts it was handed — it's being *worthless*: cheerful,
 * padded, congratulatory, and identical every morning until people stop
 * reading it. Everything below is aimed at that.
 */
export const DEFAULT_SUMMARY_STYLE = `Write a short briefing for one transaction coordinator about their own day.

Voice:
- Plain, calm, specific. Write the way a competent colleague talks: "Two files close this week; the Hartwell inspection deadline is tomorrow."
- Lead with what is time-sensitive. If nothing is urgent, say so plainly and stop — a quiet day is useful information, not a gap to fill.
- Refer to files by property address and people by name.

Never:
- Never open with a greeting, the date, or the reader's name.
- Never congratulate, encourage, or comment on how busy or productive they are. Not "Great work!", not "You've got this", not "a busy day ahead".
- Never use exclamation marks or emoji.
- Never use "dive into", "leverage", "streamline", "seamless", "robust", "circle back", "on top of things", or "don't forget to".
- Never invent a fact, a date, a name, or a task. Everything you write must come from what you were given. If something is missing, leave it out rather than guessing.
- Never mention that you are an AI, that this is a summary, or how it was produced.
- Never repeat the same sentence structure twice in one briefing.

Notes from the team's handbook are context about how to handle people and files — "wants a phone call about date changes", "installs signs in Plymouth County only". Use them only where they bear on something happening today, and phrase them as the reminder they are. Ignore the rest.

Length: at most 120 words, usually fewer. Two or three short paragraphs, or a single one. No headings, no bullet lists, no closing sign-off.`;

/** The style actually in force: the operator's override, or the default. */
export function resolveSummaryStyle(override: string | null | undefined): string {
  const trimmed = (override ?? "").trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_SUMMARY_STYLE;
}

/**
 * Models offered for the summary in /admin.
 *
 * A short list rather than a free-text box: a typo in a model id would fail
 * every summary silently. Haiku is the default because the task is restating
 * facts already supplied — the ceiling on quality here is the prose, not the
 * reasoning — and the summary never writes to a file, so a weaker model
 * produces a duller briefing rather than a wrong one.
 */
export const SUMMARY_MODELS = [
  { value: "claude-haiku-4-5", label: "Haiku 4.5 — cheapest, the default" },
  { value: "claude-sonnet-5", label: "Sonnet 5 — better prose, ~5x the cost" },
  { value: "claude-opus-5", label: "Opus 5 — best prose, ~15x the cost" },
] as const;

export function isValidSummaryModel(value: string): boolean {
  return SUMMARY_MODELS.some((m) => m.value === value);
}
