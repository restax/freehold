import { describe, expect, it } from "vitest";
import {
  CONTACT_COLUMNS,
  CONTACT_LOCKED_KEYS,
  contactColumnByKey,
  contactColumnGroups,
  contactTableMinWidth,
  DEFAULT_CONTACT_COLUMNS,
  normalizeContactColumns,
  resolveContactColumns,
} from "./contact-columns";

const keys = (cols: { key: string }[]) => cols.map((c) => c.key);

describe("the catalogue", () => {
  it("has unique keys — a duplicate would render a column twice", () => {
    const all = CONTACT_COLUMNS.map((c) => c.key);
    expect(new Set(all).size).toBe(all.length);
  });

  it("gives every column a width — a width-less column collapses to 0px", () => {
    for (const c of CONTACT_COLUMNS) expect(c.width).toMatch(/^[\d.]+rem$/);
  });

  it("locks the name — the only cell that links to the contact", () => {
    expect(CONTACT_LOCKED_KEYS).toEqual(["name"]);
  });

  it("defaults are all real columns", () => {
    for (const k of DEFAULT_CONTACT_COLUMNS) expect(contactColumnByKey(k)).toBeDefined();
  });

  it("offers the second person's details as columns", () => {
    // The whole reason one record holds two people — they have to be visible
    // in a list, not just on the record.
    for (const k of ["secondName", "secondEmail", "secondPhone"]) {
      expect(contactColumnByKey(k)).toBeDefined();
    }
  });

  it("has no mailing-address column — that lives on the contact's page", () => {
    for (const c of CONTACT_COLUMNS) {
      expect(c.label.toLowerCase()).not.toContain("address");
    }
  });
});

describe("contactColumnGroups", () => {
  it("keeps catalogue order and doesn't split a group", () => {
    const groups = contactColumnGroups().map((g) => g.group);
    expect(groups).toEqual([...new Set(groups)]);
    expect(groups[0]).toBe("Who");
  });

  it("accounts for every column exactly once", () => {
    const total = contactColumnGroups().reduce((n, g) => n + g.columns.length, 0);
    expect(total).toBe(CONTACT_COLUMNS.length);
  });
});

describe("resolveContactColumns", () => {
  it("honours a stored order verbatim", () => {
    expect(keys(resolveContactColumns(["name", "grade", "email"]))).toEqual([
      "name",
      "grade",
      "email",
    ]);
  });

  it("falls back to defaults when nothing usable is stored", () => {
    expect(keys(resolveContactColumns(null))).toEqual([...DEFAULT_CONTACT_COLUMNS]);
    expect(keys(resolveContactColumns([]))).toEqual([...DEFAULT_CONTACT_COLUMNS]);
    expect(keys(resolveContactColumns("garbage"))).toEqual([...DEFAULT_CONTACT_COLUMNS]);
    // The shape a preference takes after a release removes those columns.
    expect(keys(resolveContactColumns(["goneInV2"]))).toEqual([...DEFAULT_CONTACT_COLUMNS]);
  });

  it("drops unknown keys, collapses duplicates, ignores non-strings", () => {
    expect(keys(resolveContactColumns(["name", "nope", "email", "email"]))).toEqual([
      "name",
      "email",
    ]);
    expect(keys(resolveContactColumns(["name", 42, null, { key: "email" }]))).toEqual(["name"]);
  });

  it("forces the locked column back when a stored preference omits it", () => {
    expect(keys(resolveContactColumns(["email", "grade"]))).toEqual(["name", "email", "grade"]);
  });
});

describe("normalizeContactColumns", () => {
  it("cleans a submission that dropped the locked column", () => {
    expect(normalizeContactColumns(["email", "phone"])).toEqual(["name", "email", "phone"]);
  });

  it("turns an empty submission into the defaults", () => {
    expect(normalizeContactColumns([])).toEqual([...DEFAULT_CONTACT_COLUMNS]);
  });
});

describe("contactTableMinWidth", () => {
  it("sums the chosen columns so none get squeezed away", () => {
    expect(contactTableMinWidth(resolveContactColumns(["name", "grade"]))).toBe("24rem");
  });

  it("covers the default set", () => {
    expect(contactTableMinWidth(resolveContactColumns(null))).toBe("72rem");
  });
});
