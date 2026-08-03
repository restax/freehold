import { describe, expect, it } from "vitest";
import {
  chapterStartIndex,
  FIRST_TRANSACTION,
  stopsInChapter,
  TOUR_CHAPTERS,
  TOUR_STOPS,
} from "./demo-tour";
import { INTEGRATION_CATALOG } from "./integration-catalog";

describe("the demo tour script", () => {
  it("shows about thirty things, which is the point of it", () => {
    expect(TOUR_STOPS.length).toBeGreaterThanOrEqual(28);
    expect(TOUR_STOPS.length).toBeLessThanOrEqual(34);
  });

  it("gives every stop a unique id, since the id is also its audio filename", () => {
    const ids = TOUR_STOPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses filename-safe ids", () => {
    for (const s of TOUR_STOPS) expect(s.id).toMatch(/^[a-z0-9-]+$/);
  });

  it("puts every stop in a chapter that exists", () => {
    const known = new Set(TOUR_CHAPTERS.map((c) => c.id));
    for (const s of TOUR_STOPS) expect(known).toContain(s.chapter);
  });

  it("leaves no chapter empty, so the jump menu can never dead-end", () => {
    for (const c of TOUR_CHAPTERS) expect(stopsInChapter(c.id).length).toBeGreaterThan(0);
  });

  it("keeps each chapter's stops contiguous, so skipping a chapter skips forward", () => {
    const order = TOUR_STOPS.map((s) => TOUR_CHAPTERS.findIndex((c) => c.id === s.chapter));
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThanOrEqual(order[i - 1]);
  });

  it("can find the first stop of every chapter", () => {
    for (const c of TOUR_CHAPTERS) expect(chapterStartIndex(c.id)).toBeGreaterThanOrEqual(0);
  });

  it("routes somewhere real: a dashboard path or the transaction token", () => {
    for (const s of TOUR_STOPS) {
      const ok = s.route === FIRST_TRANSACTION || s.route.startsWith("/dashboard");
      expect(ok, `${s.id} routes to ${s.route}`).toBe(true);
    }
  });

  it("gives every stop something to say", () => {
    for (const s of TOUR_STOPS) {
      expect(s.title.length, s.id).toBeGreaterThan(0);
      expect(s.narration.split(/\s+/).length, s.id).toBeGreaterThan(8);
    }
  });

  it("keeps narration short enough to listen to", () => {
    // Much over 60 words and a stop outstays its welcome when spoken.
    for (const s of TOUR_STOPS) {
      expect(s.narration.split(/\s+/).length, s.id).toBeLessThanOrEqual(60);
    }
  });

  it("has no em-dashes or en-dashes, which are banned in anything user-facing", () => {
    for (const s of TOUR_STOPS) {
      expect(s.narration, s.id).not.toMatch(/[—–]/);
      expect(s.title, s.id).not.toMatch(/[—–]/);
    }
    for (const c of TOUR_CHAPTERS) {
      expect(`${c.title} ${c.blurb}`, c.id).not.toMatch(/[—–]/);
    }
  });

  it("spells out numerals in narration, so the voice reads them naturally", () => {
    // "$50" and "14" get read inconsistently by TTS; the script says them in words.
    for (const s of TOUR_STOPS) expect(s.narration, s.id).not.toMatch(/\$\d|\d{2,}/);
  });

  it("points integration stops at catalog keys that actually exist", () => {
    // The integrations page derives every card's anchor from its catalog key,
    // so a stop naming a key that was never in the catalog silently loses its
    // spotlight. This caught the Claude connector being keyed "mcp", not
    // "claude", after the tour had already been written against the guess.
    const keys = new Set(INTEGRATION_CATALOG.map((e) => e.key));
    for (const s of TOUR_STOPS) {
      const m = s.selector?.match(/^\[data-tour="integration-(.+)"\]$/);
      if (!m) continue;
      expect(keys, `${s.id} points at integration-${m[1]}`).toContain(m[1]);
    }
  });

  it("anchors to data-tour attributes rather than fragile markup", () => {
    for (const s of TOUR_STOPS) {
      if (!s.selector) continue;
      expect(s.selector, s.id).toMatch(/^\[data-tour="[a-z0-9-]+"\]$/);
    }
  });
});
