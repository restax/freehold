import { describe, expect, it } from "vitest";
import { canAccept, canDecline, canRevoke, isConnected } from "./vendor-connections";

const requested = (by: "TENANT" | "VENDOR") => ({ status: "REQUESTED", requestedBy: by }) as const;

describe("vendor connection state machine", () => {
  it("only the receiving side may accept a pending request", () => {
    // A tenant asked; the vendor accepts, not the tenant.
    expect(canAccept(requested("TENANT"), "VENDOR")).toBe(true);
    expect(canAccept(requested("TENANT"), "TENANT")).toBe(false);
    // A vendor asked; the tenant accepts.
    expect(canAccept(requested("VENDOR"), "TENANT")).toBe(true);
    expect(canAccept(requested("VENDOR"), "VENDOR")).toBe(false);
  });

  it("decline follows the same receiving-side rule", () => {
    expect(canDecline(requested("TENANT"), "VENDOR")).toBe(true);
    expect(canDecline(requested("TENANT"), "TENANT")).toBe(false);
  });

  it("nothing can be accepted once it's active, declined, or revoked", () => {
    for (const status of ["ACTIVE", "DECLINED", "REVOKED"] as const) {
      expect(canAccept({ status, requestedBy: "TENANT" }, "VENDOR")).toBe(false);
    }
  });

  it("only an active connection can be revoked", () => {
    expect(canRevoke({ status: "ACTIVE", requestedBy: "TENANT" })).toBe(true);
    for (const status of ["REQUESTED", "DECLINED", "REVOKED"] as const) {
      expect(canRevoke({ status, requestedBy: "TENANT" })).toBe(false);
    }
  });

  it("orders flow only across a live connection", () => {
    expect(isConnected("ACTIVE")).toBe(true);
    for (const status of ["REQUESTED", "DECLINED", "REVOKED"] as const) {
      expect(isConnected(status)).toBe(false);
    }
  });
});
