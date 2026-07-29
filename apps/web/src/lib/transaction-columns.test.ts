import { describe, expect, it } from "vitest";
import {
  columnByKey,
  columnGroups,
  DEFAULT_COLUMN_KEYS,
  LOCKED_KEYS,
  normalizeColumnSelection,
  resolveColumns,
  TRANSACTION_COLUMNS,
  tableMinWidth,
} from "./transaction-columns";

const keys = (cols: { key: string }[]) => cols.map((c) => c.key);

describe("the catalogue itself", () => {
  it("has unique keys — a duplicate would render a column twice", () => {
    const all = TRANSACTION_COLUMNS.map((c) => c.key);
    expect(new Set(all).size).toBe(all.length);
  });

  it("gives every column a width — a width-less column collapses to 0px", () => {
    // Regression: the address column once had no width so it could absorb
    // slack. With enough other columns there was no slack, it rendered 0px
    // wide, and the only link into the transaction became unclickable.
    for (const c of TRANSACTION_COLUMNS) expect(c.width).toMatch(/^[\d.]+rem$/);
  });

  it("locks the address — the only cell that links to the file", () => {
    expect(LOCKED_KEYS).toEqual(["address"]);
  });

  it("defaults are all real columns", () => {
    for (const k of DEFAULT_COLUMN_KEYS) expect(columnByKey(k)).toBeDefined();
  });
});

describe("tableMinWidth", () => {
  it("sums the chosen columns so none of them get squeezed away", () => {
    const cols = resolveColumns(["address", "status"]); // 16rem + 9rem
    expect(tableMinWidth(cols)).toBe("25rem");
  });

  it("covers the default set", () => {
    expect(tableMinWidth(resolveColumns(null))).toBe("79rem");
  });
});

describe("columnGroups", () => {
  it("keeps catalogue order and doesn't split a group across sections", () => {
    const groups = columnGroups().map((g) => g.group);
    expect(groups).toEqual([...new Set(groups)]);
    expect(groups[0]).toBe("Property location");
  });

  it("accounts for every column exactly once", () => {
    const total = columnGroups().reduce((n, g) => n + g.columns.length, 0);
    expect(total).toBe(TRANSACTION_COLUMNS.length);
  });
});

describe("resolveColumns", () => {
  it("honours a stored order verbatim", () => {
    expect(keys(resolveColumns(["address", "closeDate", "status"]))).toEqual([
      "address",
      "closeDate",
      "status",
    ]);
  });

  it("falls back to defaults when nothing is stored", () => {
    expect(keys(resolveColumns(null))).toEqual([...DEFAULT_COLUMN_KEYS]);
    expect(keys(resolveColumns([]))).toEqual([...DEFAULT_COLUMN_KEYS]);
    expect(keys(resolveColumns("garbage"))).toEqual([...DEFAULT_COLUMN_KEYS]);
  });

  it("falls back when every stored key is unknown, rather than rendering nothing", () => {
    // The shape a preference takes after a release removes those columns.
    expect(keys(resolveColumns(["removedInV2", "alsoGone"]))).toEqual([...DEFAULT_COLUMN_KEYS]);
  });

  it("drops unknown keys but keeps the recognised ones", () => {
    expect(keys(resolveColumns(["address", "notAColumn", "status"]))).toEqual([
      "address",
      "status",
    ]);
  });

  it("collapses duplicates", () => {
    expect(keys(resolveColumns(["address", "status", "status"]))).toEqual(["address", "status"]);
  });

  it("forces a locked column back in when a stored preference omits it", () => {
    expect(keys(resolveColumns(["status", "closeDate"]))).toEqual([
      "address",
      "status",
      "closeDate",
    ]);
  });

  it("ignores non-string entries", () => {
    expect(keys(resolveColumns(["address", 42, null, { key: "status" }]))).toEqual(["address"]);
  });
});

describe("normalizeColumnSelection", () => {
  it("round-trips a good selection unchanged", () => {
    const sel = ["address", "status", "price"];
    expect(normalizeColumnSelection(sel)).toEqual(sel);
  });

  it("cleans a selection that dropped the locked column", () => {
    expect(normalizeColumnSelection(["price", "status"])).toEqual(["address", "price", "status"]);
  });

  it("turns an empty submission into the defaults", () => {
    expect(normalizeColumnSelection([])).toEqual([...DEFAULT_COLUMN_KEYS]);
  });
});
