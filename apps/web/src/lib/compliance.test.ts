import { ComplianceSlotStatus, ComplianceStatus } from "@freehold/db";
import { describe, expect, it } from "vitest";
import {
  checklistForSide,
  complianceProgress,
  effectiveTier,
  rollupStatus,
  sideFits,
} from "./compliance";

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

describe("checklistForSide", () => {
  const defaults = {
    complianceBuyId: "buy",
    complianceSellId: "sell",
    complianceDualId: "dual",
    complianceChecklistId: "fallback",
  };

  it("picks the side-specific default", () => {
    expect(checklistForSide("BUY_SIDE", defaults)).toBe("buy");
    expect(checklistForSide("SELL_SIDE", defaults)).toBe("sell");
    expect(checklistForSide("DUAL", defaults)).toBe("dual");
  });

  it("falls back to the general assignment when that side has none", () => {
    expect(checklistForSide("BUY_SIDE", { ...defaults, complianceBuyId: null })).toBe("fallback");
  });

  it("is null when the client has nothing set at all", () => {
    expect(
      checklistForSide("SELL_SIDE", {
        complianceBuyId: null,
        complianceSellId: null,
        complianceDualId: null,
        complianceChecklistId: null,
      }),
    ).toBeNull();
  });

  it("keeps working for a client that only ever had the old single field", () => {
    // The upgrade path: nothing per-side set, one legacy assignment.
    const legacy = {
      complianceBuyId: null,
      complianceSellId: null,
      complianceDualId: null,
      complianceChecklistId: "legacy",
    };
    expect(checklistForSide("BUY_SIDE", legacy)).toBe("legacy");
    expect(checklistForSide("DUAL", legacy)).toBe("legacy");
  });
});

describe("sideFits", () => {
  it("lets a BOTH checklist serve every side", () => {
    expect(sideFits("BOTH", "BUY_SIDE")).toBe(true);
    expect(sideFits("BOTH", "DUAL")).toBe(true);
  });

  it("flags a mismatch between a sided checklist and the file", () => {
    expect(sideFits("BUY_SIDE", "BUY_SIDE")).toBe(true);
    expect(sideFits("BUY_SIDE", "SELL_SIDE")).toBe(false);
  });
});

describe("complianceProgress", () => {
  it("counts only required slots", () => {
    const p = complianceProgress([
      slot(true, APPROVED),
      slot(true, MISSING),
      // Optional and unattached: must not make the file look incomplete.
      slot(false, MISSING),
    ]);
    expect(p.total).toBe(2);
    expect(p.done).toBe(1);
    expect(p.remaining).toBe(1);
    expect(p.percent).toBe(50);
  });

  it("treats submitted-but-unapproved as still outstanding", () => {
    const p = complianceProgress([slot(true, SUBMITTED), slot(true, ATTACHED)]);
    expect(p.done).toBe(0);
    expect(p.remaining).toBe(2);
  });

  it("surfaces returned documents separately", () => {
    const p = complianceProgress([slot(true, RETURNED), slot(true, APPROVED)]);
    expect(p.returned).toBe(1);
    expect(p.remaining).toBe(1);
  });

  it("reads as complete when nothing is required", () => {
    const p = complianceProgress([slot(false, MISSING)]);
    expect(p.total).toBe(0);
    expect(p.remaining).toBe(0);
    expect(p.percent).toBe(100);
  });
});
