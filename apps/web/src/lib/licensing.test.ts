import { describe, expect, it } from "vitest";
import { gapMessage, licenseGap } from "./licensing";

const now = new Date("2026-07-20T00:00:00.000Z");
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const required = new Set(["TX", "FL"]);

describe("licenseGap", () => {
  it("passes when a current license covers the state", () => {
    expect(
      licenseGap(
        {
          state: "TX",
          requiredStates: required,
          assigneeLicenses: [{ state: "TX", expiresAt: d("2027-01-01") }],
        },
        now,
      ),
    ).toBeNull();
  });

  it("passes for a state the tenant has not flagged", () => {
    expect(
      licenseGap({ state: "CO", requiredStates: required, assigneeLicenses: [] }, now),
    ).toBeNull();
  });

  it("passes when the transaction has no state — we never guess", () => {
    expect(
      licenseGap({ state: null, requiredStates: required, assigneeLicenses: [] }, now),
    ).toBeNull();
  });

  it("flags a required state with nobody licensed", () => {
    expect(
      licenseGap({ state: "TX", requiredStates: required, assigneeLicenses: [] }, now),
    ).toEqual({ state: "TX", expiredOnly: false });
  });

  it("does not accept a license for a different state", () => {
    expect(
      licenseGap(
        {
          state: "TX",
          requiredStates: required,
          assigneeLicenses: [{ state: "FL", expiresAt: null }],
        },
        now,
      ),
    ).toEqual({ state: "TX", expiredOnly: false });
  });

  it("distinguishes an expired license from none at all", () => {
    expect(
      licenseGap(
        {
          state: "TX",
          requiredStates: required,
          assigneeLicenses: [{ state: "TX", expiresAt: d("2026-01-01") }],
        },
        now,
      ),
    ).toEqual({ state: "TX", expiredOnly: true });
  });

  it("accepts a license with no expiry on record", () => {
    expect(
      licenseGap(
        {
          state: "TX",
          requiredStates: required,
          assigneeLicenses: [{ state: "TX", expiresAt: null }],
        },
        now,
      ),
    ).toBeNull();
  });

  it("passes when any one assignee is licensed, even if another's lapsed", () => {
    expect(
      licenseGap(
        {
          state: "TX",
          requiredStates: required,
          assigneeLicenses: [
            { state: "TX", expiresAt: d("2026-01-01") },
            { state: "TX", expiresAt: d("2027-06-01") },
          ],
        },
        now,
      ),
    ).toBeNull();
  });

  it("normalizes case on both sides", () => {
    expect(
      licenseGap(
        {
          state: "tx",
          requiredStates: required,
          assigneeLicenses: [{ state: "tx", expiresAt: null }],
        },
        now,
      ),
    ).toBeNull();
  });
});

describe("gapMessage", () => {
  it("tells you to renew when the license merely lapsed", () => {
    expect(gapMessage({ state: "TX", expiredOnly: true })).toContain("expired");
  });

  it("tells you to assign someone when there is no license at all", () => {
    expect(gapMessage({ state: "TX", expiredOnly: false })).toContain("Assign someone");
  });
});
