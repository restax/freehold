import { describe, expect, it } from "vitest";
import {
  defaultLayout,
  type FormLayout,
  isFormKind,
  layoutFields,
  MAPPED_FIELDS,
  mappedField,
  normalizeLayout,
  parseLayout,
  parseParty,
  slugifyFormName,
  submitterFrom,
  validateSubmission,
} from "./form-schema";

const field = (key: string, extra: Record<string, unknown> = {}) => ({
  id: `c_${key}`,
  kind: "field",
  type: "text",
  key,
  label: key,
  ...extra,
});

const layout = (...rows: unknown[]): FormLayout =>
  parseLayout({ rows: rows.map((cells, i) => ({ id: `r${i}`, cells })) });

describe("parseLayout", () => {
  it("keeps well-formed rows and fields", () => {
    const l = layout([field("propertyAddress", { required: true })]);
    expect(l.rows).toHaveLength(1);
    expect(layoutFields(l)[0]).toMatchObject({ key: "propertyAddress", required: true });
  });

  it("reads junk as an empty form instead of throwing", () => {
    // These render on public, unauthenticated pages — a crash is worse.
    expect(parseLayout(null).rows).toEqual([]);
    expect(parseLayout("nope").rows).toEqual([]);
    expect(parseLayout({ rows: "nope" }).rows).toEqual([]);
    expect(parseLayout({ rows: [{ id: "r", cells: "nope" }] }).rows).toEqual([]);
  });

  it("drops cells missing the parts a field needs, and rows left empty", () => {
    expect(layout([{ id: "c", kind: "field", type: "text" }]).rows).toEqual([]); // no key/label
    expect(layout([{ kind: "field", type: "text", key: "k", label: "L" }]).rows).toEqual([]); // no id
    expect(layout([{ id: "c", kind: "field", type: "wat", key: "k", label: "L" }]).rows).toEqual(
      [],
    );
    expect(layout([{ id: "b", kind: "block", type: "wat" }]).rows).toEqual([]);
  });

  it("keeps blocks, which carry no key", () => {
    const l = layout([{ id: "b", kind: "block", type: "divider" }]);
    expect(l.rows[0].cells[0]).toEqual({ id: "b", kind: "block", type: "divider" });
    expect(layoutFields(l)).toEqual([]);
  });
});

describe("normalizeLayout", () => {
  it("clamps a row to two cells", () => {
    const l = layout([field("a"), field("b"), field("c")]);
    expect(l.rows[0].cells).toHaveLength(2);
  });

  it("renames duplicate keys so an answer can't be silently overwritten", () => {
    const l = layout([field("email")], [field("email")]);
    expect(layoutFields(l).map((f) => f.key)).toEqual(["email", "email_2"]);
  });

  it("is idempotent", () => {
    const once = normalizeLayout(defaultLayout("transaction_intake"));
    expect(normalizeLayout(once)).toEqual(once);
  });
});

describe("validateSubmission", () => {
  it("accepts a filled-in form", () => {
    const l = layout([field("email", { type: "email", required: true })]);
    expect(validateSubmission(l, { email: "dana@office.example" })).toEqual({});
  });

  it("flags missing required answers, and ignores blank optional ones", () => {
    const l = layout([field("a", { required: true }), field("b")]);
    expect(Object.keys(validateSubmission(l, { a: "  ", b: "" }))).toEqual(["a"]);
  });

  it("checks the shape of typed answers", () => {
    // One field per row: a row holds at most two cells, and a third would be
    // clamped away before it could be validated.
    const l = layout(
      [field("email", { type: "email" })],
      [field("price", { type: "number" })],
      [field("close", { type: "date" })],
    );
    const errs = validateSubmission(l, {
      email: "not-an-email",
      price: "abc",
      close: "next tuesday",
    });
    expect(Object.keys(errs).sort()).toEqual(["close", "email", "price"]);
    // Money arrives with typing noise; that's fine.
    expect(validateSubmission(l, { price: "$1,250,000" }).price).toBeUndefined();
  });

  it("holds a choice to its listed options", () => {
    const l = layout([field("side", { type: "select", options: ["Buy side", "Sell side"] })]);
    expect(validateSubmission(l, { side: "Buy side" })).toEqual({});
    expect(validateSubmission(l, { side: "Neither" }).side).toBeDefined();
  });

  it("a required party needs a name; a bad email in one is caught", () => {
    const l = layout([field("attorney", { type: "party", required: true })]);
    expect(validateSubmission(l, { attorney: { name: "R. Vance" } })).toEqual({});
    expect(validateSubmission(l, { attorney: { phone: "555-0100" } }).attorney).toBeDefined();
    expect(
      validateSubmission(layout([field("a", { type: "party" })]), {
        a: { name: "X", email: "bad" },
      }).a,
    ).toBeDefined();
  });

  it("leaves uploads to the submit action", () => {
    const l = layout([field("contractFile", { type: "file", required: true })]);
    expect(validateSubmission(l, {})).toEqual({});
  });
});

describe("parseParty", () => {
  it("keeps any one field and reads empty as absent", () => {
    expect(parseParty({ name: " R. Vance ", email: "", phone: null })).toEqual({
      name: "R. Vance",
    });
    expect(parseParty({})).toBeNull();
    expect(parseParty("R. Vance")).toBeNull();
  });
});

describe("submitterFrom", () => {
  it("finds the contact details wherever the TC put them", () => {
    expect(submitterFrom({ clientName: "Priya Raman", email: "p@x.example" })).toEqual({
      name: "Priya Raman",
      email: "p@x.example",
      phone: null,
    });
    expect(submitterFrom({ billingEmail: "ap@x.example" }).email).toBe("ap@x.example");
    expect(submitterFrom({}).name).toBeNull();
  });

  it("falls back to a party when the form has no plain contact field", () => {
    // A transaction form often carries only parties; the review queue still
    // needs something to show.
    expect(
      submitterFrom({
        propertyAddress: "88 Larkspur Way",
        attorney: { name: "R. Vance", email: "rvance@lawoffice.example" },
      }),
    ).toEqual({ name: "R. Vance", email: "rvance@lawoffice.example", phone: null });
  });

  it("a plain contact field still wins over a party", () => {
    expect(
      submitterFrom({
        clientName: "Priya Raman",
        attorney: { name: "R. Vance" },
      }).name,
    ).toBe("Priya Raman");
  });
});

describe("mapped fields", () => {
  it("every mapped key is unique within its kind", () => {
    for (const kind of ["client_intake", "transaction_intake"] as const) {
      const keys = MAPPED_FIELDS[kind].map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("resolves a key to what it binds to, and unknown keys are custom", () => {
    expect(mappedField("transaction_intake", "closeDate")?.binds).toBe("Close date");
    expect(mappedField("transaction_intake", "favouriteColour")).toBeNull();
  });
});

describe("defaultLayout", () => {
  it("starts both kinds with a usable, valid form", () => {
    for (const kind of ["client_intake", "transaction_intake"] as const) {
      const l = defaultLayout(kind);
      expect(l.rows.length).toBeGreaterThan(3);
      // Round-trips through storage unchanged.
      expect(parseLayout(JSON.parse(JSON.stringify(l)))).toEqual(l);
      // No row over the cap, and every key unique.
      expect(l.rows.every((r) => r.cells.length <= 2)).toBe(true);
      const keys = layoutFields(l).map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("only uses keys that actually bind to a column", () => {
    for (const kind of ["client_intake", "transaction_intake"] as const) {
      for (const f of layoutFields(defaultLayout(kind))) {
        expect(mappedField(kind, f.key), `${kind}.${f.key}`).not.toBeNull();
      }
    }
  });

  it("an empty transaction form fails on the fields a file can't do without", () => {
    const errs = validateSubmission(defaultLayout("transaction_intake"), {});
    expect(Object.keys(errs).sort()).toEqual(["propertyAddress", "side"]);
  });
});

describe("slugifyFormName / isFormKind", () => {
  it("makes a URL segment, with a fallback", () => {
    expect(slugifyFormName("New Transaction — Residential!")).toBe("new-transaction-residential");
    expect(slugifyFormName("///")).toBe("form");
  });

  it("guards the kind", () => {
    expect(isFormKind("client_intake")).toBe(true);
    expect(isFormKind("whatever")).toBe(false);
  });
});
