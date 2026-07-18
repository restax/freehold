import { describe, expect, it } from "vitest";
import { addDays, computeDueDate, instantiatePlan } from "./index.js";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("addDays", () => {
  it("adds forward across month boundaries", () => {
    expect(addDays(d("2026-07-30"), 3).toISOString().slice(0, 10)).toBe("2026-08-02");
  });
  it("subtracts with negative offsets", () => {
    expect(addDays(d("2026-08-01"), -2).toISOString().slice(0, 10)).toBe("2026-07-30");
  });
});

describe("computeDueDate", () => {
  const anchors = { contractDate: d("2026-07-01"), closeDate: d("2026-07-31") };

  it("anchors to contract date", () => {
    const due = computeDueDate(
      { title: "Order title", anchor: "CONTRACT_DATE", offsetDays: 3, sortOrder: 0 },
      anchors,
    );
    expect(due?.toISOString().slice(0, 10)).toBe("2026-07-04");
  });

  it("anchors to close date with negative offset", () => {
    const due = computeDueDate(
      { title: "Final walkthrough", anchor: "CLOSE_DATE", offsetDays: -1, sortOrder: 0 },
      anchors,
    );
    expect(due?.toISOString().slice(0, 10)).toBe("2026-07-30");
  });

  it("returns null when the anchor date is missing", () => {
    const due = computeDueDate(
      { title: "x", anchor: "CLOSE_DATE", offsetDays: 5, sortOrder: 0 },
      { contractDate: d("2026-07-01"), closeDate: null },
    );
    expect(due).toBeNull();
  });
});

describe("instantiatePlan", () => {
  it("keeps every template (even without anchor) and sorts by sortOrder", () => {
    const tasks = instantiatePlan(
      [
        { title: "b", anchor: "CLOSE_DATE", offsetDays: 0, sortOrder: 2 },
        { title: "a", anchor: "CONTRACT_DATE", offsetDays: 1, sortOrder: 1 },
      ],
      { contractDate: d("2026-07-01"), closeDate: null },
    );
    expect(tasks.map((t) => t.title)).toEqual(["a", "b"]);
    expect(tasks[0]?.dueDate?.toISOString().slice(0, 10)).toBe("2026-07-02");
    expect(tasks[1]?.dueDate).toBeNull();
  });
});
