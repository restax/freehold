import { ComplianceSlotStatus, ComplianceStatus } from "@freehold/db";
import { describe, expect, it } from "vitest";
import { effectiveTier, rollupStatus } from "./compliance";

const slot = (required: boolean, status: ComplianceSlotStatus) => ({ required, status });
const { MISSING, ATTACHED, SUBMITTED, APPROVED, RETURNED } = ComplianceSlotStatus;

describe("effectiveTier", () => {
  it("falls back to the role when no tier is assigned", () => {
    expect(effectiveTier("owner", null, 2)).toBe(2);
    expect(effectiveTier("admin", null, 2)).toBe(2);
    expect(effectiveTier("member", null, 2)).toBe(0);
  });

  it("lets an explicit tier override the role in both directions", () => {
    // A member promoted to reviewer — the point of the whole feature.
    expect(effectiveTier("member", 1, 2)).toBe(1);
    // An admin stripped of review authority. 0 must not be read as "unset".
    expect(effectiveTier("admin", 0, 2)).toBe(0);
  });

  it("gives role-default reviewers whatever the round requires", () => {
    expect(effectiveTier("admin", null, 1)).toBe(1);
    expect(effectiveTier("admin", null, 3)).toBe(3);
  });
});

describe("rollupStatus", () => {
  it("is DRAFT with no slots", () => {
    expect(rollupStatus([])).toBe(ComplianceStatus.DRAFT);
  });

  it("lets a single returned document outrank everything else", () => {
    expect(rollupStatus([slot(true, APPROVED), slot(true, RETURNED), slot(true, SUBMITTED)])).toBe(
      ComplianceStatus.CHANGES_REQUESTED,
    );
  });

  it("approves once every required slot is approved, ignoring optional ones", () => {
    expect(rollupStatus([slot(true, APPROVED), slot(false, MISSING)])).toBe(
      ComplianceStatus.APPROVED,
    );
  });

  it("does not approve while a required slot is outstanding", () => {
    expect(rollupStatus([slot(true, APPROVED), slot(true, SUBMITTED)])).toBe(
      ComplianceStatus.SUBMITTED,
    );
  });

  it("judges by the optional slots when a checklist has no required ones", () => {
    expect(rollupStatus([slot(false, APPROVED)])).toBe(ComplianceStatus.APPROVED);
    expect(rollupStatus([slot(false, ATTACHED)])).toBe(ComplianceStatus.DRAFT);
  });

  it("stays DRAFT while documents are only attached", () => {
    expect(rollupStatus([slot(true, ATTACHED), slot(true, MISSING)])).toBe(ComplianceStatus.DRAFT);
  });
});
