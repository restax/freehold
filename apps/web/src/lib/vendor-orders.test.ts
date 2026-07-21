import { describe, expect, it } from "vitest";
import {
  canAcceptOrder,
  canCancel,
  canComplete,
  canDeclineOrder,
  canMarkMissed,
  canSchedule,
  isOpen,
} from "./vendor-orders";

const ALL = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "SCHEDULED",
  "COMPLETED",
  "DECLINED",
  "CANCELLED",
] as const;

describe("vendor order state machine", () => {
  it("open means the vendor still has work to do", () => {
    expect(ALL.filter(isOpen)).toEqual(["SENT", "ACCEPTED", "SCHEDULED"]);
  });

  it("accept only applies to a freshly sent order", () => {
    expect(canAcceptOrder("SENT")).toBe(true);
    for (const s of ALL.filter((x) => x !== "SENT")) expect(canAcceptOrder(s)).toBe(false);
  });

  it("decline is allowed before scheduling but not after", () => {
    expect(canDeclineOrder("SENT")).toBe(true);
    expect(canDeclineOrder("ACCEPTED")).toBe(true);
    expect(canDeclineOrder("SCHEDULED")).toBe(false);
    expect(canDeclineOrder("COMPLETED")).toBe(false);
  });

  it("only a scheduled order can be marked missed — the evidence case", () => {
    expect(canMarkMissed("SCHEDULED")).toBe(true);
    for (const s of ALL.filter((x) => x !== "SCHEDULED")) expect(canMarkMissed(s)).toBe(false);
  });

  it("scheduling and completing work on any open order", () => {
    for (const s of ["SENT", "ACCEPTED", "SCHEDULED"] as const) {
      expect(canSchedule(s)).toBe(true);
      expect(canComplete(s)).toBe(true);
    }
    expect(canComplete("COMPLETED")).toBe(false);
  });

  it("cancel covers everything that isn't already terminal", () => {
    expect(canCancel("SENT")).toBe(true);
    expect(canCancel("SCHEDULED")).toBe(true);
    for (const s of ["COMPLETED", "CANCELLED", "DECLINED"] as const) {
      expect(canCancel(s)).toBe(false);
    }
  });
});
