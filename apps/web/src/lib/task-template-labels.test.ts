import { describe, expect, it } from "vitest";
import { dateRuleText } from "./task-template-labels.js";

describe("dateRuleText", () => {
  it("reads a zero offset as landing on the anchor", () => {
    expect(dateRuleText("CLOSE_DATE", 0)).toBe("On close date");
  });

  it("reads a positive offset as after", () => {
    expect(dateRuleText("CONTRACT_DATE", 3)).toBe("3 days after contract date");
  });

  it("reads a negative offset as before, without leaking the minus sign", () => {
    expect(dateRuleText("CLOSE_DATE", -1)).toBe("1 day before close date");
  });

  it("singularises one day", () => {
    expect(dateRuleText("CONTRACT_DATE", 1)).toBe("1 day after contract date");
  });

  it("reads TEMPLATE_START at zero as the apply day itself, not 'on' it", () => {
    expect(dateRuleText("TEMPLATE_START", 0)).toBe("Day the plan is applied");
  });

  it("names the task a dependency waits on", () => {
    expect(dateRuleText("DEPENDENCY", 1, "Confirm closed & funded")).toBe(
      "1 day after “Confirm closed & funded” is completed",
    );
  });

  it("falls back gracefully when the dependency has no title yet", () => {
    expect(dateRuleText("DEPENDENCY", 0, null)).toBe("The day another task is completed");
  });

  it("reads a negative dependency offset as before the completion", () => {
    expect(dateRuleText("DEPENDENCY", -2, "Send invoice")).toBe(
      "2 days before “Send invoice” is completed",
    );
  });

  it("passes an unknown anchor through rather than rendering blank", () => {
    expect(dateRuleText("SOMETHING_NEW", 0)).toBe("On something_new");
  });
});
