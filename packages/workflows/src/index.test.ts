import { describe, expect, it } from "vitest";
import {
  addDays,
  computeDueDate,
  dependencyTree,
  dependentDueDate,
  instantiatePlan,
  wouldCycle,
} from "./index.js";

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

describe("the extended anchors", () => {
  const anchors = {
    contractDate: d("2026-07-01"),
    closeDate: d("2026-07-31"),
    listDate: d("2026-06-01"),
    expireDate: d("2026-12-01"),
    mortgageCommitmentDate: d("2026-07-20"),
    inspectionDeadlineDate: d("2026-07-11"),
    earnestMoneyDueDate: d("2026-07-04"),
    templateStart: d("2026-07-15"),
  };
  const cases: Array<[Parameters<typeof computeDueDate>[0]["anchor"], number, string]> = [
    ["LIST_DATE", 7, "2026-06-08"],
    ["EXPIRE_DATE", -30, "2026-11-01"],
    ["MORTGAGE_COMMITMENT_DATE", 0, "2026-07-20"],
    ["INSPECTION_DEADLINE_DATE", -2, "2026-07-09"],
    ["EARNEST_MONEY_DUE_DATE", 1, "2026-07-05"],
    ["TEMPLATE_START", 2, "2026-07-17"],
  ];
  for (const [anchor, offsetDays, expected] of cases) {
    it(`resolves ${anchor}`, () => {
      const due = computeDueDate({ title: "x", anchor, offsetDays, sortOrder: 0 }, anchors);
      expect(due?.toISOString().slice(0, 10)).toBe(expected);
    });
  }

  it("leaves a DEPENDENCY entry undated — nothing has completed yet", () => {
    const due = computeDueDate(
      { title: "Thank-you note", anchor: "DEPENDENCY", offsetDays: 1, sortOrder: 0 },
      anchors,
    );
    expect(due).toBeNull();
  });
});

describe("wouldCycle", () => {
  const chain = [
    { id: "a", dependsOnId: null, sortOrder: 0 },
    { id: "b", dependsOnId: "a", sortOrder: 1 },
    { id: "c", dependsOnId: "b", sortOrder: 2 },
  ];

  it("rejects an entry pointing at itself", () => {
    expect(wouldCycle(chain, "a", "a")).toBe(true);
  });

  it("rejects closing a longer loop", () => {
    // a → c would make a wait on c, which waits on b, which waits on a.
    expect(wouldCycle(chain, "a", "c")).toBe(true);
  });

  it("allows extending a chain", () => {
    const withD = [...chain, { id: "d", dependsOnId: null, sortOrder: 3 }];
    expect(wouldCycle(withD, "d", "c")).toBe(false);
  });

  it("allows two entries waiting on the same one", () => {
    const withD = [...chain, { id: "d", dependsOnId: null, sortOrder: 3 }];
    expect(wouldCycle(withD, "d", "a")).toBe(false);
  });
});

describe("dependencyTree", () => {
  it("nests dependents under what they wait on, in sort order", () => {
    const tree = dependencyTree([
      { id: "b", dependsOnId: "a", sortOrder: 2 },
      { id: "a", dependsOnId: null, sortOrder: 1 },
      { id: "c", dependsOnId: "b", sortOrder: 3 },
    ]);
    expect(tree.map((n) => n.entry.id)).toEqual(["a"]);
    expect(tree[0]?.children.map((n) => n.entry.id)).toEqual(["b"]);
    expect(tree[0]?.children[0]?.children.map((n) => n.entry.id)).toEqual(["c"]);
  });

  it("shows an entry whose dependency was deleted as a root rather than hiding it", () => {
    const tree = dependencyTree([{ id: "orphan", dependsOnId: "gone", sortOrder: 1 }]);
    expect(tree.map((n) => n.entry.id)).toEqual(["orphan"]);
  });

  it("shows entries stuck in a loop as roots rather than recursing forever", () => {
    const tree = dependencyTree([
      { id: "a", dependsOnId: "b", sortOrder: 1 },
      { id: "b", dependsOnId: "a", sortOrder: 2 },
    ]);
    expect(tree.map((n) => n.entry.id).sort()).toEqual(["a", "b"]);
    expect(tree.every((n) => n.children.length === 0)).toBe(true);
  });

  it("keeps siblings ordered by sortOrder, not insertion order", () => {
    const tree = dependencyTree([
      { id: "late", dependsOnId: "root", sortOrder: 9 },
      { id: "early", dependsOnId: "root", sortOrder: 2 },
      { id: "root", dependsOnId: null, sortOrder: 1 },
    ]);
    expect(tree[0]?.children.map((n) => n.entry.id)).toEqual(["early", "late"]);
  });
});

describe("dependentDueDate", () => {
  it("drops the completion's time of day before offsetting", () => {
    const completedAt = new Date("2026-07-30T21:45:00.000Z");
    expect(dependentDueDate(completedAt, 1).toISOString()).toBe("2026-07-31T00:00:00.000Z");
  });

  it("dates same-day when the offset is zero", () => {
    expect(
      dependentDueDate(new Date("2026-07-30T08:00:00.000Z"), 0).toISOString().slice(0, 10),
    ).toBe("2026-07-30");
  });

  it("handles a negative offset (chase before the thing it follows)", () => {
    expect(
      dependentDueDate(new Date("2026-08-01T00:00:00.000Z"), -3).toISOString().slice(0, 10),
    ).toBe("2026-07-29");
  });
});
