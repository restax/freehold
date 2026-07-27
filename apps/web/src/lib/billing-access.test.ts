import { describe, expect, it } from "vitest";
import { billingCapability, billingRoleLabel } from "./billing-access";

describe("billingCapability", () => {
  it("owners and admins always hold everything, whatever billingRole says", () => {
    for (const role of ["owner", "admin"]) {
      expect(billingCapability(role, null)).toEqual({ view: true, manage: true, comp: true });
      expect(billingCapability(role, "view")).toEqual({ view: true, manage: true, comp: true });
    }
  });

  it("members get exactly what was granted, nothing by default", () => {
    expect(billingCapability("member", null)).toEqual({ view: false, manage: false, comp: false });
    expect(billingCapability("member", "view")).toEqual({
      view: true,
      manage: false,
      comp: false,
    });
    expect(billingCapability("member", "manage")).toEqual({
      view: true,
      manage: true,
      comp: false,
    });
    expect(billingCapability("member", "full")).toEqual({ view: true, manage: true, comp: true });
  });

  it("guests never see money, even with a grant", () => {
    expect(billingCapability("guest", "full")).toEqual({ view: false, manage: false, comp: false });
  });

  it("unknown grants fail closed", () => {
    expect(billingCapability("member", "superuser")).toEqual({
      view: false,
      manage: false,
      comp: false,
    });
  });
});

describe("billingRoleLabel", () => {
  it("reads sensibly for each state", () => {
    expect(billingRoleLabel("owner", null)).toBe("Full authority");
    expect(billingRoleLabel("member", null)).toBe("No billing access");
    expect(billingRoleLabel("member", "manage")).toBe("Manage billing");
    expect(billingRoleLabel("member", "full")).toBe("Full (incl. team pay)");
  });
});
