import { describe, expect, it } from "vitest";
import {
  DEFAULT_TASK_COLUMNS,
  normalizeTaskColumns,
  resolveTaskColumns,
  TASK_COLUMNS,
  TASK_LOCKED_KEYS,
  taskColumnByKey,
  taskColumnGroups,
  taskTableMinWidth,
} from "./task-columns";

const keys = (cols: { key: string }[]) => cols.map((c) => c.key);

describe("the catalogue", () => {
  it("has unique keys — a duplicate would render a column twice", () => {
    const all = TASK_COLUMNS.map((c) => c.key);
    expect(new Set(all).size).toBe(all.length);
  });

  it("gives every column a width — a width-less column collapses to 0px", () => {
    for (const c of TASK_COLUMNS) expect(c.width).toMatch(/^[\d.]+rem$/);
  });

  it("locks the title — a row with no task text says nothing", () => {
    expect(TASK_LOCKED_KEYS).toEqual(["title"]);
  });

  it("defaults are all real columns", () => {
    for (const k of DEFAULT_TASK_COLUMNS) expect(taskColumnByKey(k)).toBeDefined();
  });

  it("offers no column for the row's own controls", () => {
    // Ticking a task, flagging it, sharing it and deleting it are actions, not
    // data. If any became a hideable column, a coordinator could hide the
    // checkbox and lose the ability to complete anything.
    for (const c of TASK_COLUMNS) {
      expect(["done", "toggle", "delete", "actions", "email"]).not.toContain(c.key);
    }
  });

  it("groups every column under a heading the picker can show", () => {
    for (const c of TASK_COLUMNS) expect(c.group.length).toBeGreaterThan(0);
    expect(taskColumnGroups().length).toBeGreaterThan(1);
  });
});

describe("resolving a stored preference", () => {
  it("keeps the old layout as the default — due, task, priority", () => {
    // Nobody's view should change until they open the picker themselves.
    expect(keys(resolveTaskColumns(null))).toEqual(["dueDate", "title", "priority"]);
  });

  it("keeps the due date on the left when the preference names the title", () => {
    // Locked columns are only forced to the front when they're missing, so a
    // preference that includes the title keeps its own order.
    expect(keys(resolveTaskColumns(["dueDate", "title"]))).toEqual(["dueDate", "title"]);
  });

  it("forces the title back in when a preference leaves it out", () => {
    expect(keys(resolveTaskColumns(["dueDate", "priority"]))).toEqual([
      "title",
      "dueDate",
      "priority",
    ]);
  });

  it("drops keys that no longer exist rather than rendering blanks", () => {
    // A column removed in a later release is still sitting in saved prefs.
    expect(keys(resolveTaskColumns(["title", "retiredColumn", "dueDate"]))).toEqual([
      "title",
      "dueDate",
    ]);
  });

  it("collapses duplicates", () => {
    expect(keys(resolveTaskColumns(["title", "title", "dueDate"]))).toEqual(["title", "dueDate"]);
  });

  it("falls back to defaults rather than rendering an empty table", () => {
    for (const bad of [[], ["nope"], "not-an-array", 42, {}]) {
      expect(keys(resolveTaskColumns(bad))).toEqual([...DEFAULT_TASK_COLUMNS]);
    }
  });

  it("normalize round-trips to storable keys", () => {
    expect(normalizeTaskColumns(["priority", "title"])).toEqual(["priority", "title"]);
    expect(normalizeTaskColumns([])).toEqual([...DEFAULT_TASK_COLUMNS]);
  });
});

describe("table width", () => {
  it("sums the chosen columns so none get squeezed to nothing", () => {
    const cols = resolveTaskColumns(["dueDate", "title"]);
    // 7rem + 22rem
    expect(taskTableMinWidth(cols)).toBe("29rem");
  });
});
