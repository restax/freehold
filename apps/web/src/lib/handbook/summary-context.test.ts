import { describe, expect, it } from "vitest";
import type { HandbookNoteLike, Viewer } from "../handbook";
import {
  buildSummaryContext,
  isStale,
  SUMMARY_MAX_AGE_MS,
  type SummaryInput,
} from "./summary-context";

const NOW = new Date("2026-07-30T12:00:00.000Z");

const note = (subjectType: HandbookNoteLike["subjectType"], subjectId: string, body: string) => ({
  id: `${subjectType}:${subjectId}:${body}`,
  subjectType,
  subjectId,
  body,
  authorName: "Priya",
  relevantUntil: null,
  createdAt: NOW,
});

const base = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  viewer: { memberId: "me", role: "member" } as Viewer,
  personName: "Priya",
  overdue: [],
  dueToday: [],
  closingSoon: [],
  alerts: [],
  notes: [],
  ...over,
});

describe("isStale", () => {
  it("treats a never-written briefing as stale", () => {
    expect(isStale(null, NOW)).toBe(true);
    expect(isStale(undefined, NOW)).toBe(true);
  });

  it("keeps one written within the hour", () => {
    expect(isStale(new Date(NOW.getTime() - 59 * 60 * 1000), NOW)).toBe(false);
  });

  it("expires one written an hour ago", () => {
    // This is what makes "once an hour while signed in" true with no cron:
    // the next page load after the hour is what pays for the next write.
    expect(isStale(new Date(NOW.getTime() - SUMMARY_MAX_AGE_MS), NOW)).toBe(true);
  });
});

describe("buildSummaryContext", () => {
  it("returns nothing at all on a genuinely empty day", () => {
    // No context means no model call — a quiet day is a real answer, and the
    // screen's own empty lists already say so.
    expect(buildSummaryContext(base(), NOW)).toBe("");
  });

  it("includes the work the screen is showing", () => {
    const ctx = buildSummaryContext(
      base({
        overdue: [{ title: "Confirm earnest money", due: "Jul 17", property: "412 Maple Ave" }],
        dueToday: [{ title: "Order appraisal", property: "88 Harbor Lane" }],
        closingSoon: [{ property: "918 Elm Ridge", date: "Aug 4" }],
        alerts: ["88 Harbor Lane has been quiet for 9 days"],
      }),
      NOW,
    );
    expect(ctx).toContain("Confirm earnest money");
    expect(ctx).toContain("412 Maple Ave");
    expect(ctx).toContain("Order appraisal");
    expect(ctx).toContain("918 Elm Ridge");
    expect(ctx).toContain("quiet for 9 days");
  });

  it("never puts a member note in a non-admin's briefing", () => {
    // The rule that matters most. A briefing is written for one person, and
    // a note about a colleague must not be summarised at them.
    const ctx = buildSummaryContext(
      base({
        viewer: { memberId: "me", role: "member" },
        dueToday: [{ title: "Something", property: null }],
        notes: [
          note("CLIENT", "c1", "Wants a call about date changes"),
          note("MEMBER", "priya", "Proofread her emails"),
        ],
      }),
      NOW,
    );
    expect(ctx).toContain("Wants a call about date changes");
    expect(ctx).not.toContain("Proofread her emails");
  });

  it("still excludes the reader's own note from an admin's briefing", () => {
    const ctx = buildSummaryContext(
      base({
        viewer: { memberId: "me", role: "owner" },
        dueToday: [{ title: "Something", property: null }],
        notes: [note("MEMBER", "me", "Works evenings"), note("MEMBER", "sam", "Chase her drafts")],
      }),
      NOW,
    );
    expect(ctx).not.toContain("Works evenings");
    expect(ctx).toContain("Chase her drafts");
  });

  it("drops expired notes", () => {
    const stale = {
      ...note("CLIENT", "c1", "Away in June"),
      relevantUntil: new Date("2026-06-30"),
    };
    const ctx = buildSummaryContext(
      base({ dueToday: [{ title: "x", property: null }], notes: [stale] }),
      NOW,
    );
    expect(ctx).not.toContain("Away in June");
  });

  it("caps a long list and says how many were left out", () => {
    // Sixty overdue tasks restated back is not a briefing. The count is the
    // useful part.
    const many = Array.from({ length: 30 }, (_, i) => ({
      title: `Task ${i}`,
      due: "Jul 1",
      property: null,
    }));
    const ctx = buildSummaryContext(base({ overdue: many }), NOW);
    expect(ctx).toContain("Task 0");
    expect(ctx).not.toContain("Task 29");
    expect(ctx).toMatch(/and 18 more/);
  });

  it("omits sections that have nothing in them", () => {
    const ctx = buildSummaryContext(
      base({ dueToday: [{ title: "One thing", property: null }] }),
      NOW,
    );
    expect(ctx).toContain("Due today");
    expect(ctx).not.toContain("Overdue tasks");
    expect(ctx).not.toContain("Closing soon");
  });
});
