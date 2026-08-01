import { describe, expect, it } from "vitest";
import { planSplits, splitFilename, unclaimedPages } from "./pdf-split";

describe("splitFilename", () => {
  it("adds .pdf exactly once", () => {
    expect(splitFilename("Addendum")).toBe("Addendum.pdf");
    expect(splitFilename("Addendum.pdf")).toBe("Addendum.pdf");
    expect(splitFilename("Addendum.PDF")).toBe("Addendum.pdf");
  });

  it("falls back rather than producing a bare extension", () => {
    expect(splitFilename("   ")).toBe("split.pdf");
    expect(splitFilename(".pdf")).toBe("split.pdf");
  });
});

describe("planSplits", () => {
  const spec = (over: Partial<Parameters<typeof planSplits>[0][number]> = {}) => ({
    name: "Part",
    from: 1,
    to: 1,
    ...over,
  });

  it("converts an inclusive 1-based range to 0-based indices", () => {
    const { splits, errors } = planSplits([spec({ from: 2, to: 4 })], 10);
    expect(errors).toEqual([]);
    expect(splits[0].pageIndices).toEqual([1, 2, 3]);
  });

  it("accepts a single-page split", () => {
    expect(planSplits([spec({ from: 3, to: 3 })], 5).splits[0].pageIndices).toEqual([2]);
  });

  it("accepts the whole document", () => {
    expect(planSplits([spec({ from: 1, to: 4 })], 4).splits[0].pageIndices).toEqual([0, 1, 2, 3]);
  });

  it("rejects a range running past the end", () => {
    const { errors } = planSplits([spec({ from: 1, to: 9 })], 4);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("past the end (4 pages)");
  });

  it("rejects a backwards range", () => {
    expect(planSplits([spec({ from: 5, to: 2 })], 10).errors[0]).toContain("is after");
  });

  it("rejects page numbers below 1", () => {
    expect(planSplits([spec({ from: 0, to: 2 })], 10).errors[0]).toContain("start at 1");
  });

  it("rejects two splits writing the same filename", () => {
    const { errors } = planSplits(
      [spec({ name: "Deed" }), spec({ name: "deed.pdf", from: 2, to: 2 })],
      5,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("already used");
  });

  it("reports every problem at once, not just the first", () => {
    // Four ranges with two faults should not take two round trips to fix.
    const { errors } = planSplits([spec({ from: 9, to: 9 }), spec({ from: 4, to: 2 })], 5);
    expect(errors).toHaveLength(2);
  });

  it("produces no splits at all when anything is wrong", () => {
    // A partial split leaves the source half-carved with no record of intent.
    const { splits } = planSplits([spec({ from: 1, to: 2 }), spec({ from: 99, to: 99 })], 5);
    expect(splits).toEqual([]);
  });

  it("requires at least one split", () => {
    expect(planSplits([], 5).errors).toContain("Add at least one split.");
  });

  it("refuses a document with no pages", () => {
    expect(planSplits([spec()], 0).errors.join(" ")).toContain("no pages");
  });

  it("carries the folder through", () => {
    expect(planSplits([spec({ folderId: "f1" })], 3).splits[0].folderId).toBe("f1");
  });
});

describe("unclaimedPages", () => {
  it("lists pages no split takes", () => {
    const { splits } = planSplits(
      [
        { name: "a", from: 2, to: 3 },
        { name: "b", from: 6, to: 6 },
      ],
      7,
    );
    expect(unclaimedPages(splits, 7)).toEqual([1, 4, 5, 7]);
  });

  it("is empty when the splits cover everything", () => {
    const { splits } = planSplits([{ name: "a", from: 1, to: 4 }], 4);
    expect(unclaimedPages(splits, 4)).toEqual([]);
  });

  it("tolerates splits that overlap", () => {
    const { splits } = planSplits(
      [
        { name: "a", from: 1, to: 3 },
        { name: "b", from: 2, to: 4 },
      ],
      5,
    );
    expect(unclaimedPages(splits, 5)).toEqual([5]);
  });
});
