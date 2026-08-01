import { describe, expect, it } from "vitest";
import { transactionDraftFrom } from "./form-convert";
import {
  isField,
  layoutFields,
  MAPPED_FIELDS,
  mappedField,
  parseLayout,
  validateSubmission,
} from "./form-schema";
import { FORM_TEMPLATES, formTemplate, templatesForKind } from "./form-templates";

describe("the template library", () => {
  it("has unique ids", () => {
    const ids = FORM_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers at least one template for every kind", () => {
    for (const kind of ["client_intake", "transaction_intake", "listing_intake"] as const) {
      expect(templatesForKind(kind).length).toBeGreaterThan(0);
    }
  });

  it("returns null for an id that isn't in the library", () => {
    // The picker posts this id from the browser, so it is untrusted input.
    expect(formTemplate("../../etc/passwd")).toBeNull();
    expect(formTemplate("")).toBeNull();
  });
});

describe.each(FORM_TEMPLATES)("template $id", (t) => {
  const layout = t.layout();
  const fields = layoutFields(layout);

  it("survives a round trip through the tolerant parser", () => {
    // parseLayout is what actually reads the row back out of the database.
    // A template that doesn't survive it installs as a blank form.
    const reparsed = parseLayout(JSON.parse(JSON.stringify(layout)));
    expect(reparsed.rows).toEqual(layout.rows);
  });

  it("asks something", () => {
    expect(fields.length).toBeGreaterThan(0);
  });

  it("has no duplicate answer keys", () => {
    // normalizeLayout would rename a clash to key_2, so a duplicate doesn't
    // crash — it silently splits one question's answers across two keys.
    const keys = fields.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => !/_\d+$/.test(k))).toBe(true);
  });

  it("gives every field a label and every choice its options", () => {
    for (const f of fields) {
      expect(f.label.trim()).not.toBe("");
      if (f.type === "select") expect(f.options?.length ?? 0).toBeGreaterThan(1);
    }
  });

  it("only uses mapped keys that really bind, with the right type", () => {
    // A field typed "text" under the key `closeDate` would reach the
    // converter as a string and be dropped on the floor.
    for (const f of fields) {
      const m = mappedField(t.kind, f.key);
      if (m) expect(f.type).toBe(m.type);
    }
  });

  it("never lands a mapped key of another kind in the notes", () => {
    // MAPPED_FIELDS is per kind: a key that binds for transaction_intake is
    // just a custom question on a listing form, and would be appended to the
    // file's notes instead of filling the column the author expected.
    const mine = new Set(MAPPED_FIELDS[t.kind].map((f) => f.key));
    const others = new Set(
      Object.entries(MAPPED_FIELDS)
        .filter(([kind]) => kind !== t.kind)
        .flatMap(([, defs]) => defs.map((d) => d.key)),
    );
    for (const f of fields) {
      if (others.has(f.key)) expect(mine.has(f.key)).toBe(true);
    }
  });

  it("doesn't repeat its own intro as the first paragraph", () => {
    // The description renders directly above the first row on the public
    // page, so a paragraph that restates it reads as a rendering bug.
    const first = layout.rows[0]?.cells[0];
    if (first && !isField(first) && first.type === "paragraph" && first.text) {
      const opener = t.intro.split(/[.!?]/)[0].trim().toLowerCase();
      expect(first.text.toLowerCase()).not.toContain(opener);
    }
  });

  it("carries no third-party branding", () => {
    // These started as one company's forms. Shipping their name or inbox as
    // a product template would put another business's details in front of
    // every TC's clients.
    const text = JSON.stringify(layout) + t.name + t.description + t.intro + t.title;
    expect(text).not.toMatch(/turn.?key/i);
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/jotform/i);
  });
});

describe("the full contract template", () => {
  const t = formTemplate("full_contract");
  if (!t) throw new Error("full_contract missing");
  const layout = t.layout();

  it("cannot be submitted empty", () => {
    const errors = validateSubmission(layout, {});
    expect(Object.keys(errors).length).toBeGreaterThan(0);
    expect(errors.propertyAddress).toBeDefined();
    expect(errors.acknowledgement).toBeDefined();
  });

  it("accepts a filled-in submission and opens a real file from it", () => {
    const values: Record<string, unknown> = {
      agentName: "Dana Reyes",
      propertyAddress: "88 Harbor Lane",
      city: "Springfield",
      state: "IL",
      serviceRequested: "Compliance only — no lending, no repairs, no contact with the parties",
      side: "Buy side",
      financing: "No — cash",
      buyer: { name: "Sam Okonkwo", email: "sam@example.org" },
      titleCompany: { name: "First Title" },
      commissionSplit: "2% / 3%",
      commissionPayer: "Seller",
      homeInspection: "Not applicable",
      occupied: "No — vacant",
      newConstruction: "No",
      hoaDocs: "Not applicable",
      attendingClosing: "Yes",
      maritalStatus: "Single",
      exchange1031: "No",
      closeDate: "2026-09-30",
      purchasePrice: "$425,000",
      notes: "none",
      acknowledgement: true,
    };
    expect(validateSubmission(layout, values)).toEqual({});

    const draft = transactionDraftFrom(values);
    expect(draft).not.toBeNull();
    expect(draft?.propertyAddress).toBe("88 Harbor Lane");
    expect(draft?.side).toBe("BUY_SIDE");
    expect(draft?.purchasePrice).toBe(425000);
    expect(draft?.closeDate?.toISOString()).toBe("2026-09-30T00:00:00.000Z");
  });

  it("rejects a choice answer that isn't one of the offered options", () => {
    const errors = validateSubmission(layout, { occupied: "maybe" });
    expect(errors.occupied).toBeDefined();
  });

  it("splits the tick-all list into one key each", () => {
    const specials = layoutFields(layout).filter((f) => f.key.startsWith("special"));
    expect(specials).toHaveLength(8);
    expect(specials.every((f) => f.type === "checkbox")).toBe(true);
    expect(specials.every((f) => f.required !== true)).toBe(true);
  });
});

describe("the full listing template", () => {
  const t = formTemplate("full_listing");
  if (!t) throw new Error("full_listing missing");
  const layout = t.layout();

  it("binds the go-live date rather than asking for it as free text", () => {
    const listDate = layoutFields(layout).find((f) => f.key === "listDate");
    expect(listDate?.type).toBe("date");
  });

  it("puts the seller on a party field so they become a contact on the file", () => {
    const seller = layoutFields(layout).find((f) => f.key === "seller");
    expect(seller?.type).toBe("party");
    expect(seller?.required).toBe(true);
  });

  it("keeps the headings that introduce its sections", () => {
    const blocks = layout.rows.flatMap((r) => r.cells).filter((c) => !isField(c));
    expect(blocks.some((b) => b.type === "heading")).toBe(true);
  });
});
