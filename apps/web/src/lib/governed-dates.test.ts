import { describe, expect, it } from "vitest";
import {
  amendmentTitle,
  GOVERNED_DATE_FIELDS,
  governedDateDecision,
  isGovernedDateField,
  isKeyDateField,
  KEY_DATE_LABELS,
} from "./governed-dates";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("governedDateDecision", () => {
  it("applies a first entry", () => {
    // Nothing to contradict yet, so this is data entry rather than an
    // amendment — and anchored tasks need it to land to get their dates.
    expect(governedDateDecision(null, d("2026-08-04"))).toEqual({ kind: "apply" });
    expect(governedDateDecision(undefined, d("2026-08-04"))).toEqual({ kind: "apply" });
  });

  it("proposes a change instead of writing it", () => {
    expect(governedDateDecision(d("2026-08-04"), d("2026-08-11"))).toEqual({
      kind: "propose",
      value: "2026-08-11",
    });
  });

  it("does nothing when the date is unchanged", () => {
    // Re-saving a form must not raise an amendment for a date nobody touched.
    expect(governedDateDecision(d("2026-08-04"), d("2026-08-04"))).toEqual({ kind: "noop" });
  });

  it("treats the same day at a different time as unchanged", () => {
    // Both paths store dates at UTC midnight, but a value that round-tripped
    // through a picker can carry a time. Same calendar day is the same date.
    expect(governedDateDecision(d("2026-08-04"), new Date("2026-08-04T00:00:00.000Z"))).toEqual({
      kind: "noop",
    });
  });

  it("does nothing when a date is cleared", () => {
    // Deliberate: a blank field is far more often a partial form than a
    // request to un-agree a contractual date. Never proposes, never wipes.
    expect(governedDateDecision(d("2026-08-04"), null)).toEqual({ kind: "noop" });
    expect(governedDateDecision(d("2026-08-04"), undefined)).toEqual({ kind: "noop" });
  });

  it("does nothing when there was and is no date", () => {
    expect(governedDateDecision(null, null)).toEqual({ kind: "noop" });
  });
});

describe("amendmentTitle", () => {
  it("names the date in the words a coordinator uses", () => {
    expect(amendmentTitle("closeDate", "2026-08-11")).toBe(
      "Amendment needed: closing date → 2026-08-11",
    );
    expect(amendmentTitle("contractDate", "2026-07-09")).toBe(
      "Amendment needed: contract date → 2026-07-09",
    );
  });

  it("is stable for the same field and value", () => {
    // The task is looked up and updated by this title's field, so an unstable
    // string would pile up duplicate amendment tasks.
    expect(amendmentTitle("closeDate", "2026-08-11")).toBe(
      amendmentTitle("closeDate", "2026-08-11"),
    );
  });
});

describe("isGovernedDateField", () => {
  it("accepts exactly the governed columns", () => {
    for (const f of GOVERNED_DATE_FIELDS) expect(isGovernedDateField(f)).toBe(true);
  });

  it("rejects the ungoverned date columns", () => {
    // These edit directly — no contract term behind them.
    for (const f of [
      "listDate",
      "onMarketDate",
      "mortgageCommitmentDate",
      "inspectionDeadlineDate",
      "expireDate",
    ]) {
      expect(isGovernedDateField(f)).toBe(false);
    }
  });

  it("rejects anything else, including injection-shaped input", () => {
    for (const f of ["", "id", "tenantId", "propertyAddress", "__proto__", "closeDate; drop"]) {
      expect(isGovernedDateField(f)).toBe(false);
    }
  });
});

describe("isKeyDateField", () => {
  it("accepts every column the Key dates panel shows", () => {
    for (const f of Object.keys(KEY_DATE_LABELS)) expect(isKeyDateField(f)).toBe(true);
  });

  it("covers both governed dates, so neither can be edited unguarded", () => {
    // The inline editor routes governed fields through the amendment rule.
    // A governed column missing from this map would be silently uneditable;
    // one present but not recognised as governed would overwrite a contract.
    for (const f of GOVERNED_DATE_FIELDS) expect(isKeyDateField(f)).toBe(true);
  });

  it("rejects any other column name", () => {
    // This allowlist is the only thing standing between a form field named
    // "field" and an arbitrary column write on the transaction row.
    for (const f of [
      "id",
      "tenantId",
      "propertyAddress",
      "purchasePrice",
      "status",
      "proposedDates",
      "__proto__",
      "constructor",
      "",
      "closeDate ",
      "CLOSEDATE",
    ]) {
      expect(isKeyDateField(f)).toBe(false);
    }
  });

  it("labels every field it accepts", () => {
    // The activity line reads "Set {label} to …"; a missing label would log
    // "Set undefined to 2026-08-04".
    for (const [field, label] of Object.entries(KEY_DATE_LABELS)) {
      expect(isKeyDateField(field)).toBe(true);
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
