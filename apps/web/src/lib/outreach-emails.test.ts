import { describe, expect, it } from "vitest";
import { OUTREACH_EMAILS, SETUP_OFFER_KEY } from "./outreach-emails";

describe("OUTREACH_EMAILS", () => {
  it("has email 1 live and ten placeholders after it", () => {
    expect(OUTREACH_EMAILS).toHaveLength(11);
    expect(OUTREACH_EMAILS[0]).toMatchObject({ number: 1, key: SETUP_OFFER_KEY, status: "live" });
    expect(OUTREACH_EMAILS.slice(1).every((e) => e.status === "placeholder")).toBe(true);
  });
  it("numbers and keys are unique", () => {
    expect(new Set(OUTREACH_EMAILS.map((e) => e.key)).size).toBe(11);
    expect(OUTREACH_EMAILS.map((e) => e.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});
