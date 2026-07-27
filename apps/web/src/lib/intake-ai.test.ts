import { describe, expect, it } from "vitest";
import { contractCandidates, intakeAiBlockedReason, intakeAiRuns } from "./intake-ai";

const base = { clientEnabled: true, planHasPro: true, contractCount: 1 };

describe("intakeAiRuns", () => {
  it("runs only when the TC asked for it on this client", () => {
    expect(intakeAiRuns(base)).toBe(true);
    expect(intakeAiRuns({ ...base, clientEnabled: false })).toBe(false);
  });

  it("never runs on a plan without pro AI", () => {
    // The switch can be left on from a previous plan; the gate still holds.
    expect(intakeAiRuns({ ...base, planHasPro: false })).toBe(false);
  });

  it("does nothing when nothing was attached", () => {
    expect(intakeAiRuns({ ...base, contractCount: 0 })).toBe(false);
  });
});

describe("intakeAiBlockedReason", () => {
  it("names the plan as the only blocker", () => {
    expect(intakeAiBlockedReason(false)).toBe("plan");
    expect(intakeAiBlockedReason(true)).toBeNull();
  });
});

describe("contractCandidates", () => {
  const pdf = { contentType: "application/pdf", name: "contract.pdf" };
  const jpeg = { contentType: "image/jpeg", name: "sign.jpg" };

  it("only considers PDFs", () => {
    expect(contractCandidates([jpeg, pdf]).map((f) => f.name)).toEqual(["contract.pdf"]);
    expect(contractCandidates([jpeg])).toEqual([]);
  });

  it("takes one, not every attachment", () => {
    const many = [pdf, { ...pdf, name: "addendum.pdf" }, { ...pdf, name: "disclosure.pdf" }];
    expect(contractCandidates(many).map((f) => f.name)).toEqual(["contract.pdf"]);
  });
});
