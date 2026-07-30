import { describe, expect, it } from "vitest";
import { matchQuoteItems } from "./pdf-quote-match";

/** A page split the way pdf.js splits one: lots of short fragments, and no
 *  trailing spaces on them. */
const PAGE = [
  "This",
  "16th",
  "day",
  "of",
  "September,",
  "2025",
  "8.TIME",
  "FOR",
  "PERFORMANCE;",
  "DELIVERY",
  "OF",
  "DEED:",
  "Such",
  "deed",
  "is",
  "to",
  "be",
  "delivered",
  "at",
  "6:00",
  "pm",
  "on",
  "the",
  "29th",
  "day",
  "of",
  "October,",
  "2025",
  "at",
  "the",
  "office",
  "of",
  "lender's",
  "counsel,",
  "unless",
  "otherwise",
  "agreed",
  "upon",
  "in",
  "writing.",
];

const text = (idx: Set<number>) =>
  [...idx]
    .sort((a, b) => a - b)
    .map((i) => PAGE[i])
    .join(" ");

describe("matchQuoteItems", () => {
  it("highlights the cited run, not every word the quote happens to contain", () => {
    // The reported bug: hovering "Closing date" lit up every "the", "of" and
    // "at" on the page, because each fragment was tested for membership in
    // the quote rather than as part of one contiguous span.
    const hits = matchQuoteItems(
      PAGE,
      "Such deed is to be delivered at 6:00 pm on the 29th day of October, 2025",
    );
    expect(text(hits)).toBe(
      "Such deed is to be delivered at 6:00 pm on the 29th day of October, 2025",
    );

    // Only one "the" — the one inside the run. There are two on the page.
    const theCount = [...hits].filter((i) => PAGE[i] === "the").length;
    expect(theCount).toBe(1);
    // The stray "of"s outside the run stay unhighlighted.
    expect(hits.has(3)).toBe(false); // "of" in "16th day of September"
    expect(hits.has(31)).toBe(false); // "of" in "office of lender's"
  });

  it("never highlights on a quote that is only common words", () => {
    // Guards the specific symptom: a short, stopword-only quote must light up
    // nothing rather than the whole page.
    expect(matchQuoteItems(PAGE, "the").size).toBe(0);
    expect(matchQuoteItems(PAGE, "and").size).toBe(0);
    expect(matchQuoteItems(PAGE, "of the").size).toBe(0);
  });

  it("joins fragments that pdf.js emitted without a separating space", () => {
    const items = ["15", "California", "Avenue,", "Milton,"];
    const hits = matchQuoteItems(items, "15 California Avenue");
    expect(text2(items, hits)).toBe("15 California Avenue,");
  });

  it("matches across a fragment that only partly overlaps the quote", () => {
    // "September," carries a comma the quote doesn't; the run still matches
    // and the whole fragment is highlighted, since it can't be split.
    const hits = matchQuoteItems(PAGE, "This 16th day of September");
    expect(text(hits)).toBe("This 16th day of September,");
  });

  it("falls back to the longest run that is actually on the page", () => {
    // A quote whose tail disagrees with the PDF — the model tidied it, or it
    // ran past a page break. The matching head should still be found.
    const hits = matchQuoteItems(
      PAGE,
      "Such deed is to be delivered at 6:00 pm on the 29th day of NOVEMBER, 1999",
    );
    expect(text(hits)).toContain("Such deed is to be delivered");
    expect(hits.size).toBeGreaterThan(5);
  });

  it("tolerates smart quotes and elision marks around the citation", () => {
    const hits = matchQuoteItems(PAGE, "“Such deed is to be delivered … in writing.”");
    expect(text(hits)).toContain("Such deed is to be delivered");
  });

  it("is case- and whitespace-insensitive", () => {
    const hits = matchQuoteItems(PAGE, "  SUCH   DEED\n IS  TO   BE  DELIVERED ");
    expect(text(hits)).toBe("Such deed is to be delivered");
  });

  it("returns nothing rather than guessing when the quote is absent", () => {
    expect(matchQuoteItems(PAGE, "no such language appears anywhere here").size).toBe(0);
  });

  it("handles empty input without throwing", () => {
    expect(matchQuoteItems([], "anything at all").size).toBe(0);
    expect(matchQuoteItems(PAGE, "").size).toBe(0);
  });
});

function text2(items: string[], idx: Set<number>) {
  return [...idx]
    .sort((a, b) => a - b)
    .map((i) => items[i])
    .join(" ");
}
