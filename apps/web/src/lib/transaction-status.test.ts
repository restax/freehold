import { describe, expect, it } from "vitest";
import {
  CLOSED_STATUSES,
  isOpenStatus,
  OPEN_STATUSES,
  statusGroups,
  TRANSACTION_STATUSES,
} from "./transaction-status";

describe("the lifecycle list", () => {
  it("has no duplicates", () => {
    expect(new Set(TRANSACTION_STATUSES).size).toBe(TRANSACTION_STATUSES.length);
  });

  it("runs in lifecycle order — a draft precedes a close", () => {
    const at = (s: string) => TRANSACTION_STATUSES.indexOf(s as never);
    expect(at("DRAFT")).toBeLessThan(at("COMING_SOON"));
    expect(at("COMING_SOON")).toBeLessThan(at("ACTIVE"));
    expect(at("ACTIVE")).toBeLessThan(at("UNDER_CONTRACT"));
    expect(at("UNDER_CONTRACT")).toBeLessThan(at("PENDING"));
    expect(at("PENDING")).toBeLessThan(at("CLOSED"));
  });

  it("no longer carries LISTING — it backfilled to ACTIVE", () => {
    expect(TRANSACTION_STATUSES).not.toContain("LISTING" as never);
    expect(TRANSACTION_STATUSES).toContain("ACTIVE");
  });
});

describe("open vs closed", () => {
  it("splits every status into exactly one side", () => {
    for (const s of TRANSACTION_STATUSES) {
      const open = (OPEN_STATUSES as readonly string[]).includes(s);
      const closed = (CLOSED_STATUSES as readonly string[]).includes(s);
      expect(open !== closed).toBe(true);
    }
    expect(OPEN_STATUSES.length + CLOSED_STATUSES.length).toBe(TRANSACTION_STATUSES.length);
  });

  it("counts the new pre-offer statuses as open work", () => {
    // These are the ones a coordinator is actively chasing; if they fell out
    // of "open" they'd vanish from every saved view.
    for (const s of ["DRAFT", "COMING_SOON", "ACTIVE", "TMP_OFF_MARKET"]) {
      expect(isOpenStatus(s)).toBe(true);
      expect(OPEN_STATUSES).toContain(s);
    }
  });

  it("treats only finished files as closed", () => {
    expect([...CLOSED_STATUSES]).toEqual(["CLOSED", "CANCELLED"]);
    expect(isOpenStatus("CLOSED")).toBe(false);
    expect(isOpenStatus("CANCELLED")).toBe(false);
  });

  it("derives open from closed, so a new status defaults to open", () => {
    // The safe direction: an unrecognised status is live work, not history.
    expect(isOpenStatus("SOME_FUTURE_STATUS")).toBe(true);
  });
});

describe("statusGroups", () => {
  it("accounts for every status exactly once", () => {
    const flat = statusGroups().flatMap((g) => g.statuses);
    expect(flat.length).toBe(TRANSACTION_STATUSES.length);
    expect(new Set(flat).size).toBe(TRANSACTION_STATUSES.length);
  });

  it("puts open first — that's where most picks land", () => {
    expect(statusGroups().map((g) => g.group)).toEqual(["Open", "Closed"]);
  });
});
